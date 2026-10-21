import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import BackendContext from '../../../shared/backend/BackendContext';
import { hasStoredSession } from '../../../shared/backend/client';
import { SessionProvider, useSession } from './SessionProvider';

vi.mock('../../../shared/backend/client', async (importOriginal) => ({
  ...(await importOriginal()),
  hasStoredSession: vi.fn(),
}));

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const OTHER_SESSION = { userId: 'user-2', email: 'luis@example.test' };
const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};
const PENDING_PROFILE = {
  ...PROFILE, fullName: '', consentVersion: null, consentAt: null,
};

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// A fake auth adapter. `emit` plays a supabase-js auth event to the subscriber.
function fakeAuth(overrides = {}) {
  const unsubscribe = vi.fn();
  const auth = {
    unsubscribe,
    emit: null,
    getSession: vi.fn(async () => ok(SESSION)),
    subscribe: vi.fn(async (callback) => {
      auth.emit = callback;
      return ok(unsubscribe);
    }),
    getOwnProfile: vi.fn(async () => ok(PROFILE)),
    recordConsent: vi.fn(),
    deleteMyAccount: vi.fn(),
    signOut: vi.fn(async () => ok(null)),
    ...overrides,
  };
  return auth;
}

const seen = { current: null };
// Every status the provider rendered, in order, the first render included.
const renders = [];

function Probe() {
  const value = useSession();
  seen.current = value;
  renders.push(value.status);
  return (
    <output data-testid="status">{value.status}</output>
  );
}

function renderWith({ enabled = true, auth = fakeAuth() } = {}) {
  const services = enabled ? { auth } : null;
  const view = render(
    <BackendContext.Provider value={{ enabled, services }}>
      <SessionProvider><Probe /></SessionProvider>
    </BackendContext.Provider>,
  );
  return { auth, ...view };
}

const status = () => screen.getByTestId('status').textContent;
const waitForStatus = (expected) => waitFor(() => expect(status()).toBe(expected));

beforeEach(() => {
  hasStoredSession.mockReset();
  seen.current = null;
  renders.length = 0;
});

describe('useSession without a provider', () => {
  it('reads as a disabled session', () => {
    render(<Probe />);

    expect(seen.current).toMatchObject({
      status: 'disabled', session: null, profile: null, errorCode: null,
    });
  });
});

describe('SessionProvider while the backend is disabled', () => {
  it('stays disabled and touches nothing', async () => {
    hasStoredSession.mockReturnValue(true);
    const { auth } = renderWith({ enabled: false });

    await act(async () => { await seen.current.start(); });

    expect(status()).toBe('disabled');
    expect(hasStoredSession).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('keeps start, refresh and signOut harmless', async () => {
    const { auth } = renderWith({ enabled: false });

    let result;
    await act(async () => {
      await seen.current.start();
      await seen.current.refresh();
      result = await seen.current.signOut();
    });

    expect(status()).toBe('disabled');
    expect(auth.signOut).not.toHaveBeenCalled();
    // Nothing is held while the backend is off, so there is nothing left to end.
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe('SessionProvider while the backend is enabled', () => {
  it('renders as loading from the very first render when a session is stored', async () => {
    hasStoredSession.mockReturnValue(true);
    renderWith();

    expect(renders[0]).toBe('loading');
    expect(renders).not.toContain('idle');
    await waitForStatus('signed-in');
  });

  it('renders as idle from the very first render when no session is stored', () => {
    hasStoredSession.mockReturnValue(false);
    renderWith();

    expect(renders).toEqual(['idle']);
  });

  it('stays idle and loads nothing when no session is stored', () => {
    hasStoredSession.mockReturnValue(false);
    const { auth } = renderWith();

    expect(status()).toBe('idle');
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(seen.current.session).toBeNull();
  });

  it('starts on mount when a session is stored and ends signed in with the profile', async () => {
    hasStoredSession.mockReturnValue(true);
    const { auth } = renderWith();

    await waitForStatus('signed-in');

    expect(seen.current.session).toEqual(SESSION);
    expect(seen.current.profile).toEqual(PROFILE);
    expect(seen.current.errorCode).toBeNull();
    expect(auth.getOwnProfile).toHaveBeenCalledWith('user-1');
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });

  it('is loading while the session and profile are being read', async () => {
    hasStoredSession.mockReturnValue(true);
    let release;
    const auth = fakeAuth({
      getSession: vi.fn(() => new Promise((resolve) => { release = () => resolve(ok(SESSION)); })),
    });
    renderWith({ auth });

    await waitForStatus('loading');
    await act(async () => { release(); });
    await waitForStatus('signed-in');
  });

  it('reports a pending profile as it is: consentAt null', async () => {
    hasStoredSession.mockReturnValue(true);
    renderWith({ auth: fakeAuth({ getOwnProfile: vi.fn(async () => ok(PENDING_PROFILE)) }) });

    await waitForStatus('signed-in');

    expect(seen.current.profile.consentAt).toBeNull();
  });

  it('ends signed out, without loading a profile, when the stored session is gone', async () => {
    hasStoredSession.mockReturnValue(true);
    const { auth } = renderWith({ auth: fakeAuth({ getSession: vi.fn(async () => ok(null)) }) });

    await waitForStatus('signed-out');

    expect(auth.getOwnProfile).not.toHaveBeenCalled();
    expect(seen.current.profile).toBeNull();
  });

  it('ends in error with only the code when the session cannot be read', async () => {
    hasStoredSession.mockReturnValue(true);
    renderWith({ auth: fakeAuth({ getSession: vi.fn(async () => fail('NETWORK')) }) });

    await waitForStatus('error');

    expect(seen.current.errorCode).toBe('NETWORK');
  });

  it('ends in error with the code when the profile cannot be read', async () => {
    hasStoredSession.mockReturnValue(true);
    renderWith({ auth: fakeAuth({ getOwnProfile: vi.fn(async () => fail('FORBIDDEN')) }) });

    await waitForStatus('error');

    expect(seen.current.errorCode).toBe('FORBIDDEN');
    expect(seen.current.profile).toBeNull();
  });

  describe('start', () => {
    it('loads on demand when no session was stored', async () => {
      hasStoredSession.mockReturnValue(false);
      const { auth } = renderWith();

      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-in');
      expect(auth.getSession).toHaveBeenCalledTimes(1);
    });

    it('shares one load between concurrent calls and repeated calls', async () => {
      hasStoredSession.mockReturnValue(false);
      const { auth } = renderWith();

      await act(async () => {
        await Promise.all([seen.current.start(), seen.current.start()]);
        await seen.current.start();
      });

      expect(auth.getSession).toHaveBeenCalledTimes(1);
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
      expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);
    });

    it('can be retried after the profile read failed, without subscribing twice', async () => {
      hasStoredSession.mockReturnValue(false);
      const getOwnProfile = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValueOnce(ok(PROFILE));
      const { auth } = renderWith({ auth: fakeAuth({ getOwnProfile }) });

      await act(async () => { await seen.current.start(); });
      expect(status()).toBe('error');
      expect(seen.current.errorCode).toBe('NETWORK');

      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-in');
      expect(seen.current.profile).toEqual(PROFILE);
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
    });

    it('can be retried after a failed load', async () => {
      hasStoredSession.mockReturnValue(false);
      const getSession = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValueOnce(ok(SESSION));
      renderWith({ auth: fakeAuth({ getSession }) });

      await act(async () => { await seen.current.start(); });
      expect(status()).toBe('error');

      await act(async () => { await seen.current.start(); });
      expect(status()).toBe('signed-in');
      expect(seen.current.errorCode).toBeNull();
    });

    it('can be retried after a load that threw, instead of replaying the same rejection', async () => {
      hasStoredSession.mockReturnValue(false);
      const getSession = vi.fn()
        .mockRejectedValueOnce(new Error('session store unavailable'))
        .mockResolvedValueOnce(ok(SESSION));
      renderWith({ auth: fakeAuth({ getSession }) });

      await act(async () => {
        await expect(seen.current.start()).rejects.toThrow('session store unavailable');
      });
      expect(status()).toBe('error');
      expect(seen.current.errorCode).toBe('UNKNOWN');

      await act(async () => { await seen.current.start(); });
      expect(status()).toBe('signed-in');
      expect(getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('auth changes', () => {
    const signedIn = async () => {
      hasStoredSession.mockReturnValue(true);
      const view = renderWith();
      await waitForStatus('signed-in');
      return view;
    };

    it('loads the profile of a different user who signs in', async () => {
      const { auth } = await signedIn();
      auth.getOwnProfile.mockResolvedValueOnce(ok({ ...PROFILE, id: 'user-2', fullName: 'Luis' }));

      act(() => { auth.emit(OTHER_SESSION); });

      await waitFor(() => expect(seen.current.profile.fullName).toBe('Luis'));
      expect(seen.current.session).toEqual(OTHER_SESSION);
      expect(auth.getOwnProfile).toHaveBeenLastCalledWith('user-2');
    });

    it('moves to signed out when the session ends', async () => {
      const { auth } = await signedIn();

      act(() => { auth.emit(null); });

      await waitForStatus('signed-out');
      expect(seen.current.session).toBeNull();
      expect(seen.current.profile).toBeNull();
    });

    it('ignores an event for the user who is already loaded, such as a token refresh', async () => {
      const { auth } = await signedIn();

      await act(async () => {
        auth.emit(SESSION);
        await new Promise((resolve) => { setTimeout(resolve, 10); });
      });

      expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);
      expect(status()).toBe('signed-in');
    });

    it('unsubscribes when the provider unmounts', async () => {
      const { auth, unmount } = await signedIn();

      unmount();

      expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('does not leave a subscription behind when it unmounts while subscribing', async () => {
      hasStoredSession.mockReturnValue(true);
      const unsubscribe = vi.fn();
      let release;
      const auth = fakeAuth({
        unsubscribe,
        subscribe: vi.fn(() => new Promise((resolve) => {
          release = () => resolve(ok(unsubscribe));
        })),
      });
      const { unmount } = renderWith({ auth });
      await waitFor(() => expect(auth.subscribe).toHaveBeenCalledTimes(1));

      unmount();
      expect(unsubscribe).not.toHaveBeenCalled();
      await act(async () => { release(); });

      await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
      expect(auth.getOwnProfile).not.toHaveBeenCalled();
    });

    it('ends in error with the code when it cannot subscribe, and a later start retries', async () => {
      hasStoredSession.mockReturnValue(true);
      const subscribe = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValueOnce(ok(vi.fn()));
      renderWith({ auth: fakeAuth({ subscribe }) });

      await waitForStatus('error');
      expect(seen.current.errorCode).toBe('NETWORK');
      expect(seen.current.session).toBeNull();

      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-in');
      expect(subscribe).toHaveBeenCalledTimes(2);
    });

    it('never writes a profile read for a session that has since ended', async () => {
      hasStoredSession.mockReturnValue(true);
      let releaseA;
      const getOwnProfile = vi.fn(() => new Promise((resolve) => {
        releaseA = () => resolve(ok(PROFILE));
      }));
      const { auth } = renderWith({ auth: fakeAuth({ getOwnProfile }) });
      await waitFor(() => expect(getOwnProfile).toHaveBeenCalledTimes(1));

      act(() => { auth.emit(null); });
      await waitForStatus('signed-out');
      await act(async () => { releaseA(); });

      expect(status()).toBe('signed-out');
      expect(seen.current.profile).toBeNull();
      expect(seen.current.session).toBeNull();
    });

    it('never writes a profile read for a user who has since been replaced', async () => {
      hasStoredSession.mockReturnValue(true);
      let releaseA;
      const getOwnProfile = vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          releaseA = () => resolve(ok(PROFILE));
        }))
        .mockResolvedValueOnce(ok({ ...PROFILE, id: 'user-2', fullName: 'Luis' }));
      const { auth } = renderWith({ auth: fakeAuth({ getOwnProfile }) });
      await waitFor(() => expect(getOwnProfile).toHaveBeenCalledTimes(1));

      act(() => { auth.emit(OTHER_SESSION); });
      await waitFor(() => expect(seen.current.profile?.fullName).toBe('Luis'));
      await act(async () => { releaseA(); });

      expect(seen.current.profile.fullName).toBe('Luis');
      expect(seen.current.session).toEqual(OTHER_SESSION);
    });
  });

  describe('refresh', () => {
    it('reloads the own profile', async () => {
      hasStoredSession.mockReturnValue(true);
      const { auth } = renderWith();
      await waitForStatus('signed-in');
      auth.getOwnProfile.mockResolvedValueOnce(ok({ ...PROFILE, fullName: 'Ana Maria' }));

      await act(async () => { await seen.current.refresh(); });

      expect(seen.current.profile.fullName).toBe('Ana Maria');
      expect(auth.getOwnProfile).toHaveBeenCalledTimes(2);
    });

    it('does nothing when nobody is signed in', async () => {
      hasStoredSession.mockReturnValue(false);
      const { auth } = renderWith();

      await act(async () => { await seen.current.refresh(); });

      expect(auth.getOwnProfile).not.toHaveBeenCalled();
      expect(status()).toBe('idle');
    });
  });

  // A sign-out is an action, not a load. It resolves to a result and never throws:
  // ok when this device no longer holds a session (the adapter has already told
  // the two apart), a failure when one may still be held. A failure changes
  // nothing about who is signed in, so it never goes through the error status,
  // which is for a load that could not be done.
  describe('signOut', () => {
    const signedIn = async (overrides = {}) => {
      hasStoredSession.mockReturnValue(true);
      const view = renderWith({ auth: fakeAuth(overrides) });
      await waitForStatus('signed-in');
      return view;
    };

    it('calls the adapter, moves to signed out and resolves to ok', async () => {
      const { auth } = await signedIn();
      let result;

      await act(async () => { result = await seen.current.signOut(); });

      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true, data: null });
      expect(status()).toBe('signed-out');
      expect(seen.current.session).toBeNull();
      expect(seen.current.profile).toBeNull();
    });

    it('resolves to the failure, and keeps the member signed in, when a session may still be held', async () => {
      const signOut = vi.fn(async () => fail('NETWORK'));
      const { auth } = await signedIn({ signOut });
      let result;

      await act(async () => { result = await seen.current.signOut(); });

      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: false, code: 'NETWORK' });
      expect(status()).toBe('signed-in');
      expect(seen.current.session).toEqual(SESSION);
      expect(seen.current.profile).toEqual(PROFILE);
      expect(seen.current.errorCode).toBeNull();
    });

    it('never goes through the error status, which is for a load that failed', async () => {
      const signOut = vi.fn(async () => fail('NETWORK'));
      await signedIn({ signOut });

      await act(async () => { await seen.current.signOut(); });

      expect(renders).not.toContain('error');
      expect(new Set(renders)).toEqual(new Set(['loading', 'signed-in']));
    });

    it('carries only the code of a failure, whatever else the adapter sent', async () => {
      const signOut = vi.fn(async () => ({
        ok: false, code: 'NETWORK', message: 'private detail', details: 'ana@example.test',
      }));
      await signedIn({ signOut });
      let result;

      await act(async () => { result = await seen.current.signOut(); });

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });

    it('never throws: an adapter that rejects is a failure, and nothing changes', async () => {
      const signOut = vi.fn(async () => { throw new Error('boom'); });
      await signedIn({ signOut });
      let result;

      await act(async () => { result = await seen.current.signOut(); });

      expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
      expect(status()).toBe('signed-in');
      expect(seen.current.profile).toEqual(PROFILE);
    });

    it('takes an answer that is not a result for a failure, since it cannot tell', async () => {
      const signOut = vi.fn(async () => undefined);
      await signedIn({ signOut });
      let result;

      await act(async () => { result = await seen.current.signOut(); });

      expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
      expect(status()).toBe('signed-in');
    });

    it('forgets the session it ended: a refresh afterwards reads nothing and brings nobody back', async () => {
      const { auth } = await signedIn();
      await act(async () => { await seen.current.signOut(); });
      expect(status()).toBe('signed-out');

      await act(async () => { await seen.current.refresh(); });

      expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);
      expect(status()).toBe('signed-out');
      expect(seen.current.profile).toBeNull();
    });

    it('can be tried again after a failure, and the try that works moves to signed out', async () => {
      const signOut = vi.fn().mockResolvedValueOnce(fail('NETWORK')).mockResolvedValueOnce(ok(null));
      await signedIn({ signOut });
      let first;
      let second;

      await act(async () => { first = await seen.current.signOut(); });
      await act(async () => { second = await seen.current.signOut(); });

      expect(first.ok).toBe(false);
      expect(second.ok).toBe(true);
      expect(signOut).toHaveBeenCalledTimes(2);
      expect(status()).toBe('signed-out');
    });

    it('leaves the shared load alone: nothing is loaded again after a failure', async () => {
      const signOut = vi.fn().mockResolvedValueOnce(fail('NETWORK'));
      const { auth } = await signedIn({ signOut });
      await act(async () => { await seen.current.signOut(); });

      await act(async () => { await seen.current.start(); });

      expect(auth.getSession).toHaveBeenCalledTimes(1);
      expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
      expect(status()).toBe('signed-in');
    });

    it('keeps the identity of start and of signOut through a failure', async () => {
      const signOut = vi.fn().mockResolvedValueOnce(fail('NETWORK'));
      await signedIn({ signOut });
      const { start, signOut: before } = seen.current;

      await act(async () => { await seen.current.signOut(); });

      expect(seen.current.start).toBe(start);
      expect(seen.current.signOut).toBe(before);
    });

    it('follows the end of the session that auth-js announces after a request that failed', async () => {
      const signOut = vi.fn(async () => fail('NETWORK'));
      const { auth } = await signedIn({ signOut });

      await act(async () => { await seen.current.signOut(); });
      act(() => { auth.emit(null); });

      await waitForStatus('signed-out');
      expect(seen.current.session).toBeNull();
    });
  });

  // The shared load of start() is kept once it has worked, so that every page
  // asking for the session shares it. An error that the load did not produce (a
  // profile read that fails later on, after a refresh or a change of user) must
  // not leave start() replaying that finished load: the page's "try again" has to
  // load again. A sign-out that fails is no such error: it leaves no error status
  // behind, so there is nothing to try again (see the tests of signOut above).
  describe('start after an error that the shared load did not produce', () => {
    const signedIn = async (overrides = {}) => {
      hasStoredSession.mockReturnValue(true);
      const view = renderWith({ auth: fakeAuth(overrides) });
      await waitForStatus('signed-in');
      return view;
    };

    // The first read of the profile works, the next one fails, and the rest work.
    const failsOnce = () => vi.fn()
      .mockResolvedValueOnce(ok(PROFILE))
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockResolvedValue(ok(PROFILE));

    it('ends signed out when the session really ended while the profile read was failing', async () => {
      const { auth } = await signedIn({ getOwnProfile: failsOnce() });
      await act(async () => { await seen.current.refresh(); });
      expect(status()).toBe('error');
      auth.getSession.mockResolvedValueOnce(ok(null));

      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-out');
      expect(seen.current.session).toBeNull();
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
    });

    it('loads again after a refresh that failed to read the profile', async () => {
      const getOwnProfile = vi.fn()
        .mockResolvedValueOnce(ok(PROFILE))
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValue(ok(PROFILE));
      const { auth } = await signedIn({ getOwnProfile });
      await act(async () => { await seen.current.refresh(); });
      expect(status()).toBe('error');
      expect(seen.current.errorCode).toBe('NETWORK');

      await act(async () => { await seen.current.start(); });

      expect(auth.getSession).toHaveBeenCalledTimes(2);
      expect(status()).toBe('signed-in');
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
    });

    it('loads again after a change of user whose profile could not be read', async () => {
      const getOwnProfile = vi.fn()
        .mockResolvedValueOnce(ok(PROFILE))
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValue(ok({ ...PROFILE, id: 'user-2', fullName: 'Luis' }));
      const { auth } = await signedIn({ getOwnProfile });
      auth.getSession.mockResolvedValue(ok(OTHER_SESSION));
      act(() => { auth.emit(OTHER_SESSION); });
      await waitForStatus('error');
      expect(seen.current.session).toEqual(OTHER_SESSION);

      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-in');
      expect(seen.current.profile.fullName).toBe('Luis');
      expect(auth.getSession).toHaveBeenCalledTimes(2);
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps the identity of start through the error and the recovery', async () => {
      await signedIn({ getOwnProfile: failsOnce() });
      const { start } = seen.current;

      await act(async () => { await seen.current.refresh(); });
      expect(status()).toBe('error');
      expect(seen.current.start).toBe(start);
      await act(async () => { await seen.current.start(); });

      expect(status()).toBe('signed-in');
      expect(seen.current.start).toBe(start);
    });

    it('shares the new load again once it has worked, instead of reloading at every call', async () => {
      const { auth } = await signedIn({ getOwnProfile: failsOnce() });
      await act(async () => { await seen.current.refresh(); });

      await act(async () => {
        await seen.current.start();
        await Promise.all([seen.current.start(), seen.current.start()]);
      });

      expect(auth.getSession).toHaveBeenCalledTimes(2);
      // The first read, the one that failed, and the one of the new load.
      expect(auth.getOwnProfile).toHaveBeenCalledTimes(3);
    });

    it('does not load a second time while the first load is still running', async () => {
      hasStoredSession.mockReturnValue(false);
      let releaseSubscription;
      const subscribe = vi.fn(() => new Promise((resolve) => {
        releaseSubscription = () => resolve(ok(vi.fn()));
      }));
      const getOwnProfile = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValue(ok(PROFILE));
      const { auth } = renderWith({ auth: fakeAuth({ subscribe, getOwnProfile }) });
      let first;
      act(() => { first = seen.current.start(); });
      // The session is read, and the load waits for its subscription.
      await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

      // A profile read fails from outside while the load is still running.
      await act(async () => { await seen.current.refresh(); });
      expect(status()).toBe('error');
      let second;
      act(() => { second = seen.current.start(); });
      await act(async () => { releaseSubscription(); await Promise.all([first, second]); });

      expect(auth.getSession).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledTimes(1);
      // The read that failed from outside, then the load's own.
      expect(getOwnProfile).toHaveBeenCalledTimes(2);
      expect(status()).toBe('signed-in');
    });
  });
});
