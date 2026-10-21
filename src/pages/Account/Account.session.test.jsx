// The account page with the real SessionProvider: what the member finds when a
// sign-out fails, and when the session ended in an error that the first load did
// not produce (a profile that could not be read after a change of user). The unit
// tests of Account fake the whole session; this one fakes only the auth adapter,
// so the page meets the provider's own idea of what has already been loaded. For
// the sign-out the adapter is the real one over a fake supabase client that
// answers the way auth-js does, so the page, the provider and the adapter's
// decision about whether this device still holds a session are tried together.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { createAuthAdapter } from '../../features/accounts/adapters/authAdapter';
import { SessionProvider } from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import { hasStoredSession } from '../../shared/backend/client';
import Account from './Account';

vi.mock('../../shared/backend/client', async (importOriginal) => ({
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

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// What auth-js reports when its request to sign out cannot get through.
const REQUEST_FAILURE = {
  name: 'AuthRetryableFetchError', message: 'private detail', status: 0,
};

// `emit` plays a supabase-js auth event to the subscriber.
function fakeAuth(overrides = {}) {
  const auth = {
    emit: null,
    getSession: vi.fn(async () => ok(SESSION)),
    subscribe: vi.fn(async (callback) => {
      auth.emit = callback;
      return ok(vi.fn());
    }),
    getOwnProfile: vi.fn(async () => ok(PROFILE)),
    signOut: vi.fn(async () => ok()),
    ...overrides,
  };
  return auth;
}

// The real adapter's signOut over a fake supabase client. `signOut` and
// `getSession` are the two calls of auth-js that the adapter makes.
function signOutOverClient(auth) {
  return createAuthAdapter(async () => ({ auth })).signOut;
}

function renderAccount(auth) {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider>
          <Routes>
            <Route path="/account" element={<Account />} />
            <Route path="/login" element={<p>login page</p>} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </SessionProvider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

const account = () => screen.findByRole('heading', { level: 1, name: 'Mi cuenta' });
const signOutButton = () => screen.getByRole('button', { name: 'Cerrar sesión' });

describe('Account with the real session provider', () => {
  beforeEach(() => {
    hasStoredSession.mockReset();
    hasStoredSession.mockReturnValue(false);
  });

  describe('when the sign-out request fails', () => {
    it('ends signed out on the home page, with no alert, when the session is gone anyway', async () => {
      const user = userEvent.setup();
      // auth-js removed the local session before it reported the error.
      const client = {
        signOut: vi.fn(async () => ({ error: REQUEST_FAILURE })),
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      };
      const auth = fakeAuth({ signOut: signOutOverClient(client) });
      renderAccount(auth);
      await account();

      await user.click(signOutButton());

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(client.signOut).toHaveBeenCalledTimes(1);
      expect(client.getSession).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'an expired session whose refresh failed offline',
        { data: { session: null }, error: REQUEST_FAILURE },
      ],
      ['a session that is still stored', { data: { session: { user: {} } }, error: null }],
    ])('stays on "Mi cuenta" with an alert, and a second click that works goes home: %s', async (_label, answer) => {
      const user = userEvent.setup();
      const client = {
        signOut: vi.fn()
          .mockResolvedValueOnce({ error: REQUEST_FAILURE })
          .mockResolvedValueOnce({ error: null }),
        getSession: vi.fn(async () => answer),
      };
      const auth = fakeAuth({ signOut: signOutOverClient(client) });
      renderAccount(auth);
      await account();

      await user.click(signOutButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos cerrar tu sesión: sigue abierta en este dispositivo. Inténtalo de nuevo.',
      );
      expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
      expect(screen.getByText('ana@example.test')).toBeInTheDocument();
      expect(screen.queryByText('home page')).not.toBeInTheDocument();
      // It is no failed load: the page does not turn into its load error.
      expect(screen.queryByText(/No pudimos cargar tu cuenta/)).not.toBeInTheDocument();
      expect(signOutButton()).toBeEnabled();
      expect(auth.getSession).toHaveBeenCalledTimes(1);

      await user.click(signOutButton());

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(client.signOut).toHaveBeenCalledTimes(2);
      // Nothing was loaded again for the failed try.
      expect(auth.getSession).toHaveBeenCalledTimes(1);
      expect(auth.subscribe).toHaveBeenCalledTimes(1);
    });

    it('does not ask whether the session is gone when the request worked', async () => {
      const user = userEvent.setup();
      const client = {
        signOut: vi.fn(async () => ({ error: null })),
        getSession: vi.fn(),
      };
      renderAccount(fakeAuth({ signOut: signOutOverClient(client) }));
      await account();

      await user.click(signOutButton());

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(client.getSession).not.toHaveBeenCalled();
    });
  });

  it('shows the account again when "Reintentar" is pressed after a profile that could not be read', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    renderAccount(auth);
    await screen.findByText('ana@example.test');
    // Another user signs in elsewhere, and this page cannot read their profile.
    auth.getSession.mockResolvedValue(ok(OTHER_SESSION));
    auth.getOwnProfile
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockResolvedValue(ok({ ...PROFILE, id: 'user-2', fullName: 'Luis Soto' }));
    act(() => { auth.emit(OTHER_SESSION); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta. Inténtalo de nuevo.');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText('luis@example.test')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });
});
