import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function tree({ consentAccepted, services }) {
  return (
    <BackendContext.Provider value={{ enabled: true, services }}>
      <GoogleButton consentAccepted={consentAccepted} />
    </BackendContext.Provider>
  );
}

function renderButton({ auth = fakeAuth(), consentAccepted = true, services = { auth } } = {}) {
  const view = render(tree({ consentAccepted, services }));
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

  it.each([
    ['Google is off', vi.fn(async () => ok({ google: false }))],
    ['the read fails', vi.fn(async () => fail('NETWORK'))],
    ['the read is refused', vi.fn(async () => fail('RATE_LIMITED'))],
    ['the read rejects', vi.fn(async () => { throw new Error('raw failure'); })],
  ])('stays hidden when %s', async (_label, getProviders) => {
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

describe('GoogleButton consent', () => {
  it('is disabled until the consent is given', async () => {
    const { auth, rerender } = renderButton({ consentAccepted: false });

    expect(await findButton()).toBeDisabled();

    rerender(tree({ consentAccepted: true, services: { auth } }));
    expect(button()).toBeEnabled();
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
