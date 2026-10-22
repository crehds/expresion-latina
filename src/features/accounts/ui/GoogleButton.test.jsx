import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import {
  CURRENT_NOTICE_VERSION,
  readPendingConsentVersion,
} from '../domain/noticeVersion';
import GoogleButton from './GoogleButton';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function fakeAuth(overrides = {}) {
  return {
    getProviders: vi.fn(async () => ok({ google: true })),
    signInWithGoogle: vi.fn(async () => ok()),
    ...overrides,
  };
}

function tree({ consentAccepted, services, consentField }) {
  return (
    <BackendContext.Provider value={{ enabled: true, services }}>
      <GoogleButton consentAccepted={consentAccepted} consentField={consentField} />
    </BackendContext.Provider>
  );
}

function renderButton({
  auth = fakeAuth(), consentAccepted = true, services = { auth }, consentField,
} = {}) {
  const view = render(tree({ consentAccepted, services, consentField }));
  return { auth, ...view };
}

const button = () => screen.getByRole('button', { name: 'Continuar con Google' });
const findButton = () => screen.findByRole('button', { name: 'Continuar con Google' });

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('GoogleButton availability', () => {
  it('shows nothing while the backend has not said whether Google is on', async () => {
    let release;
    const getProviders = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }) });

    expect(container).toBeEmptyDOMElement();

    await act(async () => { release(ok({ google: true })); });
    expect(button()).toBeInTheDocument();
  });

  it('shows the button once the backend says Google is on', async () => {
    renderButton();

    expect(await findButton()).toBeInTheDocument();
  });

  it('asks the backend once, not at every render', async () => {
    const { auth, rerender } = renderButton();
    await findButton();

    rerender(tree({ consentAccepted: false, services: { auth } }));

    expect(auth.getProviders).toHaveBeenCalledTimes(1);
  });

  it('stays hidden when the backend says Google is off', async () => {
    const getProviders = vi.fn(async () => ok({ google: false }));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }) });

    await waitFor(() => expect(getProviders).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = renderButton({ services: null });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('GoogleButton when the backend settings cannot be read', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Lets the pending promises settle and fires the timers due within `ms`.
  const elapse = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('asks again after half a second and then after a second and a half more', async () => {
    const getProviders = vi.fn(async () => fail('NETWORK'));
    renderButton({ auth: fakeAuth({ getProviders }) });
    await elapse(0);
    expect(getProviders).toHaveBeenCalledTimes(1);

    await elapse(499);
    expect(getProviders).toHaveBeenCalledTimes(1);
    await elapse(1);
    expect(getProviders).toHaveBeenCalledTimes(2);

    await elapse(1499);
    expect(getProviders).toHaveBeenCalledTimes(2);
    await elapse(1);
    expect(getProviders).toHaveBeenCalledTimes(3);
  });

  it('stays hidden while it tries and shows the button once an answer says Google is on', async () => {
    const getProviders = vi.fn()
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockResolvedValueOnce(fail('RATE_LIMITED'))
      .mockResolvedValueOnce(ok({ google: true }));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(0);
    expect(container).toBeEmptyDOMElement();
    await elapse(500);
    expect(container).toBeEmptyDOMElement();
    await elapse(1500);

    expect(getProviders).toHaveBeenCalledTimes(3);
    expect(button()).toBeInTheDocument();
  });

  it('gives up after the third failure: the button stays hidden and nothing more is asked', async () => {
    const getProviders = vi.fn(async () => fail('NETWORK'));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(2000);
    expect(getProviders).toHaveBeenCalledTimes(3);
    await elapse(60000);

    expect(getProviders).toHaveBeenCalledTimes(3);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['NETWORK', 'RATE_LIMITED', 'UNKNOWN'])('asks again after %s', async (code) => {
    const getProviders = vi.fn()
      .mockResolvedValueOnce(fail(code))
      .mockResolvedValueOnce(ok({ google: true }));
    renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(500);

    expect(getProviders).toHaveBeenCalledTimes(2);
    expect(button()).toBeInTheDocument();
  });

  it('asks again when the read rejects', async () => {
    const getProviders = vi.fn()
      .mockRejectedValueOnce(new Error('raw failure'))
      .mockResolvedValueOnce(ok({ google: true }));
    renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(500);

    expect(getProviders).toHaveBeenCalledTimes(2);
    expect(button()).toBeInTheDocument();
  });

  it.each(['FORBIDDEN', 'INVALID', 'NOT_FOUND'])('does not ask again after %s: waiting will not change it', async (code) => {
    const getProviders = vi.fn(async () => fail(code));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(60000);

    expect(getProviders).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([true, false])('does not ask again once the backend has answered (Google %s)', async (google) => {
    const getProviders = vi.fn(async () => ok({ google }));
    renderButton({ auth: fakeAuth({ getProviders }) });

    await elapse(60000);

    expect(getProviders).toHaveBeenCalledTimes(1);
  });

  describe('when the button goes away or the service is replaced', () => {
    it('stops asking when it unmounts while a retry is waiting', async () => {
      const getProviders = vi.fn(async () => fail('NETWORK'));
      const { unmount } = renderButton({ auth: fakeAuth({ getProviders }) });
      await elapse(0);

      unmount();
      await elapse(60000);

      expect(getProviders).toHaveBeenCalledTimes(1);
    });

    it('does not retry a read that fails after the button is already gone', async () => {
      let failRead;
      const getProviders = vi.fn(
        () => new Promise((resolve) => { failRead = () => resolve(fail('NETWORK')); }),
      );
      const { unmount } = renderButton({ auth: fakeAuth({ getProviders }) });

      unmount();
      await act(async () => { failRead(); });
      await elapse(60000);

      expect(getProviders).toHaveBeenCalledTimes(1);
    });

    it('ignores the answer of a service that was replaced while it was still waiting', async () => {
      let answerOld;
      const oldAuth = fakeAuth({
        getProviders: vi.fn(() => new Promise((resolve) => { answerOld = resolve; })),
      });
      const newAuth = fakeAuth({ getProviders: vi.fn(() => new Promise(() => {})) });
      const { container, rerender } = renderButton({ auth: oldAuth });

      rerender(tree({ consentAccepted: true, services: { auth: newAuth } }));
      await act(async () => { answerOld(ok({ google: true })); });

      expect(container).toBeEmptyDOMElement();
    });

    it('drops the retry of a service that was replaced', async () => {
      const oldAuth = fakeAuth({ getProviders: vi.fn(async () => fail('NETWORK')) });
      const newAuth = fakeAuth({ getProviders: vi.fn(async () => ok({ google: false })) });
      const { rerender } = renderButton({ auth: oldAuth });
      await elapse(0);

      rerender(tree({ consentAccepted: true, services: { auth: newAuth } }));
      await elapse(60000);

      expect(oldAuth.getProviders).toHaveBeenCalledTimes(1);
      expect(newAuth.getProviders).toHaveBeenCalledTimes(1);
    });

    it('hides the button again until a replaced service says whether Google is on', async () => {
      const { container, rerender } = renderButton();
      await elapse(0);
      expect(button()).toBeInTheDocument();
      const newAuth = fakeAuth({ getProviders: vi.fn(() => new Promise(() => {})) });

      rerender(tree({ consentAccepted: true, services: { auth: newAuth } }));

      expect(container).toBeEmptyDOMElement();
    });

    it('still shows the button when React runs the effect twice, as it does while developing', async () => {
      const auth = fakeAuth();
      render(<StrictMode>{tree({ consentAccepted: true, services: { auth } })}</StrictMode>);

      await elapse(0);

      expect(button()).toBeInTheDocument();
    });
  });
});

describe('GoogleButton consent', () => {
  it('is disabled until the consent is given', async () => {
    const { auth, rerender } = renderButton({ consentAccepted: false });

    expect(await findButton()).toBeDisabled();

    rerender(tree({ consentAccepted: true, services: { auth } }));
    expect(button()).toBeEnabled();
  });
});

describe('GoogleButton consent field', () => {
  const field = <input type="checkbox" aria-label="Acepto" />;

  it('draws the field the page gives it above the button, once the button shows', async () => {
    renderButton({ consentField: field });

    const box = await screen.findByRole('checkbox', { name: 'Acepto' });
    const order = [...document.querySelectorAll('*')];
    expect(order.indexOf(box)).toBeLessThan(order.indexOf(button()));
  });

  it.each([
    ['has Google off', fakeAuth({ getProviders: vi.fn(async () => ok({ google: false })) })],
    ['cannot be read', fakeAuth({ getProviders: vi.fn(async () => fail('FORBIDDEN')) })],
  ])('draws no field while the backend %s', async (_label, auth) => {
    const { container } = renderButton({ auth, consentField: field });

    await waitFor(() => expect(auth.getProviders).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('draws no field while the answer is still on its way', () => {
    const getProviders = vi.fn(() => new Promise(() => {}));
    const { container } = renderButton({ auth: fakeAuth({ getProviders }), consentField: field });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('GoogleButton click', () => {
  it('keeps the accepted version for the callback BEFORE it starts the Google flow', async () => {
    const user = userEvent.setup();
    let storedAtTheCall = 'the call never happened';
    const signInWithGoogle = vi.fn(async () => {
      storedAtTheCall = readPendingConsentVersion();
      return ok();
    });
    renderButton({ auth: fakeAuth({ signInWithGoogle }) });

    await user.click(await findButton());

    expect(storedAtTheCall).toBe(CURRENT_NOTICE_VERSION);
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    // The page is being left, so the version stays for the callback to record.
    expect(readPendingConsentVersion()).toBe(CURRENT_NOTICE_VERSION);
  });

  it('does not keep a consent for a flow that never started', async () => {
    const user = userEvent.setup();
    renderButton({
      auth: fakeAuth({ signInWithGoogle: vi.fn(async () => fail('NETWORK')) }),
    });

    await user.click(await findButton());

    await screen.findByRole('alert');
    expect(readPendingConsentVersion()).toBeNull();
  });

  it.each([
    ['RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
    ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
  ])('shows the message of %s in an alert, nothing the backend said, and works again', async (code, message) => {
    const user = userEvent.setup();
    renderButton({
      auth: fakeAuth({
        signInWithGoogle: vi.fn(async () => fail(code, { message: 'raw failure ana@example.test' })),
      }),
    });

    await user.click(await findButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('raw failure');
    expect(alert).not.toHaveTextContent('ana@example.test');
    expect(button()).toBeEnabled();
  });

  it('shows the generic message, clears the version and works again when the call rejects', async () => {
    const user = userEvent.setup();
    renderButton({
      auth: fakeAuth({ signInWithGoogle: vi.fn(async () => { throw new Error('raw failure'); }) }),
    });

    await user.click(await findButton());

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('No pudimos completar la acción. Inténtalo de nuevo.');
    expect(readPendingConsentVersion()).toBeNull();
    expect(button()).toBeEnabled();
  });

  it('drops the message of a failed try when the next one starts', async () => {
    const user = userEvent.setup();
    const signInWithGoogle = vi.fn()
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockResolvedValueOnce(ok());
    renderButton({ auth: fakeAuth({ signInWithGoogle }) });
    await user.click(await findButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(button());

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(signInWithGoogle).toHaveBeenCalledTimes(2);
  });

  it('is disabled while the call runs', async () => {
    const user = userEvent.setup();
    let release;
    const signInWithGoogle = vi.fn(
      () => new Promise((resolve) => { release = () => resolve(fail('NETWORK')); }),
    );
    renderButton({ auth: fakeAuth({ signInWithGoogle }) });

    await user.click(await findButton());

    expect(button()).toBeDisabled();
    await act(async () => { release(); });
    await waitFor(() => expect(button()).toBeEnabled());
  });
});
