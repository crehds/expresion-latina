import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionContext from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import AuthConfirm from './AuthConfirm';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function fakeAuth(overrides = {}) {
  return {
    verifyEmailLink: vi.fn(async () => ok()),
    updatePassword: vi.fn(async () => ok()),
    resendConfirmation: vi.fn(async () => ok()),
    ...overrides,
  };
}

function fakeSession(overrides = {}) {
  return {
    status: 'idle',
    session: null,
    profile: null,
    errorCode: null,
    start: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderConfirm({
  auth = fakeAuth(),
  session = fakeSession(),
  url = '/auth/confirm?token_hash=hash-1&type=email',
} = {}) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionContext.Provider value={session}>
          <Routes>
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/login" element={<p>login page</p>} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </SessionContext.Provider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
  return { auth, session };
}

const heading = (name) => screen.getByRole('heading', { level: 1, name });
const EMAIL_URL = '/auth/confirm?token_hash=hash-1&type=email';
const RECOVERY_URL = '/auth/confirm?token_hash=hash-2&type=recovery';
const INVALID = 'El enlace no es válido.';

describe('AuthConfirm', () => {
  describe('an email confirmation link', () => {
    it('shows one button and verifies nothing until it is pressed', () => {
      const { auth, session } = renderConfirm({ url: EMAIL_URL });

      expect(heading('Confirmar correo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar mi correo' })).toBeEnabled();
      expect(auth.verifyEmailLink).not.toHaveBeenCalled();
      expect(session.start).not.toHaveBeenCalled();
    });

    it('verifies the token once, starts the session and goes to the home page', async () => {
      const user = userEvent.setup();
      const { auth, session } = renderConfirm({ url: EMAIL_URL });

      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(auth.verifyEmailLink).toHaveBeenCalledTimes(1);
      expect(auth.verifyEmailLink).toHaveBeenCalledWith({ tokenHash: 'hash-1', type: 'email' });
      expect(session.start).toHaveBeenCalledTimes(1);
      expect(auth.verifyEmailLink.mock.invocationCallOrder[0])
        .toBeLessThan(session.start.mock.invocationCallOrder[0]);
    });

    it('verifies only once however many times the button is pressed', async () => {
      const user = userEvent.setup();
      let release;
      const auth = fakeAuth({
        verifyEmailLink: vi.fn(() => new Promise((resolve) => { release = () => resolve(ok()); })),
      });
      renderConfirm({ auth, url: EMAIL_URL });
      const button = screen.getByRole('button', { name: 'Confirmar mi correo' });

      await user.click(button);
      await user.click(button);
      await user.dblClick(button);

      expect(auth.verifyEmailLink).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();
      await act(async () => { release(); });
      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(auth.verifyEmailLink).toHaveBeenCalledTimes(1);
    });

    it('still goes to the home page when starting the session fails after a good link', async () => {
      const user = userEvent.setup();
      renderConfirm({
        url: EMAIL_URL,
        session: fakeSession({ start: vi.fn(async () => { throw new Error('raw failure'); }) }),
      });

      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says the link expired and offers a new confirmation email, with an empty address', async () => {
      const user = userEvent.setup();
      const { session } = renderConfirm({
        url: EMAIL_URL,
        auth: fakeAuth({ verifyEmailLink: vi.fn(async () => fail('LINK_EXPIRED')) }),
      });

      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('El enlace venció o ya se usó. Pide uno nuevo.');
      expect(screen.queryByRole('button', { name: 'Confirmar mi correo' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Correo')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }))
        .toBeInTheDocument();
      expect(session.start).not.toHaveBeenCalled();
    });

    it('sends the confirmation email again from the expired state', async () => {
      const user = userEvent.setup();
      const { auth } = renderConfirm({
        url: EMAIL_URL,
        auth: fakeAuth({ verifyEmailLink: vi.fn(async () => fail('LINK_EXPIRED')) }),
      });
      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      await user.type(await screen.findByLabelText('Correo'), 'ana@example.test');
      await user.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));

      await waitFor(() => expect(auth.resendConfirmation).toHaveBeenCalledTimes(1));
      expect(auth.resendConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@example.test' }),
      );
    });

    it('shows the fixed message of another failure and lets the member press again', async () => {
      const user = userEvent.setup();
      const verifyEmailLink = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK', { message: 'raw failure' }))
        .mockResolvedValueOnce(ok());
      renderConfirm({ url: EMAIL_URL, auth: fakeAuth({ verifyEmailLink }) });

      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
      expect(alert).not.toHaveTextContent('raw failure');

      await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(verifyEmailLink).toHaveBeenCalledTimes(2);
    });
  });

  describe('a password recovery link', () => {
    it('shows a Continuar button and verifies nothing until it is pressed', () => {
      const { auth } = renderConfirm({ url: RECOVERY_URL });

      expect(heading('Restablecer contraseña')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
      expect(auth.verifyEmailLink).not.toHaveBeenCalled();
    });

    it('verifies the token once and shows the new-password form in place', async () => {
      const user = userEvent.setup();
      const { auth, session } = renderConfirm({ url: RECOVERY_URL });

      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument();
      expect(heading('Nueva contraseña')).toBeInTheDocument();
      expect(auth.verifyEmailLink).toHaveBeenCalledTimes(1);
      expect(auth.verifyEmailLink).toHaveBeenCalledWith({ tokenHash: 'hash-2', type: 'recovery' });
      expect(session.start).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('home page')).not.toBeInTheDocument();
    });

    it('changes the password, says so and links to the home page', async () => {
      const user = userEvent.setup();
      const { auth } = renderConfirm({ url: RECOVERY_URL });
      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      await user.type(await screen.findByLabelText('Nueva contraseña'), 'abcdefg2');
      await user.type(screen.getByLabelText('Repite la contraseña'), 'abcdefg2');
      await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Tu contraseña se actualizó.');
      expect(auth.updatePassword).toHaveBeenCalledWith({ password: 'abcdefg2' });
      expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
      expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    });

    it('says the link expired and points to a new request on the sign-in page', async () => {
      const user = userEvent.setup();
      renderConfirm({
        url: RECOVERY_URL,
        auth: fakeAuth({ verifyEmailLink: vi.fn(async () => fail('LINK_EXPIRED')) }),
      });

      await user.click(screen.getByRole('button', { name: 'Continuar' }));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('El enlace venció o ya se usó. Pide uno nuevo.');
      expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Pedir un enlace nuevo' }));
      expect(await screen.findByText('login page')).toBeInTheDocument();
    });
  });

  describe('an address that is not a valid link', () => {
    it.each([
      ['no query at all', '/auth/confirm'],
      ['no token', '/auth/confirm?type=email'],
      ['a blank token', '/auth/confirm?token_hash=%20&type=recovery'],
      ['no type', '/auth/confirm?token_hash=hash-1'],
      ['a type that is not accepted', '/auth/confirm?token_hash=hash-1&type=magiclink'],
      ['an invite type', '/auth/confirm?token_hash=hash-1&type=invite'],
      ['a mixed-case type', '/auth/confirm?token_hash=hash-1&type=Recovery'],
    ])('shows the fixed message and a way out for %s, and verifies nothing', (_name, url) => {
      const { auth, session } = renderConfirm({ url });

      expect(heading('Enlace no válido')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(INVALID);
      expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(auth.verifyEmailLink).not.toHaveBeenCalled();
      expect(session.start).not.toHaveBeenCalled();
    });
  });

  it('ignores every other parameter: a redirect target never decides where the member goes', async () => {
    const user = userEvent.setup();
    renderConfirm({
      url: '/auth/confirm?token_hash=hash-1&type=email&next=%2Flogin&redirect_to=https%3A%2F%2Fevil.test',
    });

    await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('renders nothing but the invalid state while the backend offers no auth service', () => {
    render(
      <MemoryRouter initialEntries={[EMAIL_URL]}>
        <BackendContext.Provider value={{ enabled: false, services: null }}>
          <SessionContext.Provider value={fakeSession()}>
            <AuthConfirm />
          </SessionContext.Provider>
        </BackendContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Confirmar mi correo' })).not.toBeInTheDocument();
  });
});
