import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionContext from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import Login from './Login';

const ok = (data = null) => ({ ok: true, data });

function fakeAuth(overrides = {}) {
  return {
    signInWithPassword: vi.fn(async () => ok()),
    signUp: vi.fn(async () => ok({ confirmationPending: true })),
    signInWithGoogle: vi.fn(async () => ok()),
    getProviders: vi.fn(async () => ok({ google: false })),
    ...overrides,
  };
}

function fakeSession(overrides = {}) {
  return {
    status: 'signed-out',
    session: null,
    profile: null,
    errorCode: null,
    start: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderLogin({ auth = fakeAuth(), session = fakeSession() } = {}) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionContext.Provider value={session}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </SessionContext.Provider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
  return { auth, session };
}

const consent = () => screen.getByRole('checkbox', { name: /Leí y acepto el Aviso de privacidad/ });
const switchButton = (name) => screen.getByRole('button', { name });

// Whether `first` comes before `second` in the document.
const isBefore = (first, second) => {
  const order = [...document.querySelectorAll('*')];
  return order.indexOf(first) < order.indexOf(second);
};

describe('Login', () => {
  it('starts the session, so a returning member is recognised', () => {
    const { session } = renderLogin();

    expect(session.start).toHaveBeenCalledTimes(1);
  });

  describe('as a visitor', () => {
    it.each(['idle', 'loading', 'signed-out', 'error'])('opens on the sign-in form while the status is %s', (status) => {
      renderLogin({ session: fakeSession({ status }) });

      expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeInTheDocument();
      expect(screen.getByLabelText('Correo')).toBeInTheDocument();
      expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
      expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
      expect(screen.queryByText('home page')).not.toBeInTheDocument();
    });

    it('puts the consent checkbox, unchecked, above the form', () => {
      renderLogin();

      expect(consent()).not.toBeChecked();
      expect(isBefore(consent(), screen.getByLabelText('Correo'))).toBe(true);
    });

    it('lets the member sign in without ticking the box: that account already consented', () => {
      renderLogin();

      expect(consent()).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
    });
  });

  describe('switching between sign-in and sign-up', () => {
    it('offers to create an account, and to go back', async () => {
      const user = userEvent.setup();
      renderLogin();
      expect(screen.getByText('¿Aún no tienes cuenta?')).toBeInTheDocument();

      await user.click(switchButton('Crear cuenta'));

      expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
      expect(screen.getByText('¿Ya tienes cuenta?')).toBeInTheDocument();

      await user.click(switchButton('Ingresar'));

      expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
    });

    it('keeps the consent when the form changes', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(consent());

      await user.click(switchButton('Crear cuenta'));
      expect(consent()).toBeChecked();

      await user.click(switchButton('Ingresar'));
      expect(consent()).toBeChecked();
    });

    it('keeps the sign-up button disabled until the consent is given', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(switchButton('Crear cuenta'));

      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();

      await user.click(consent());
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();

      await user.click(consent());
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
    });

    it('signs a new member up with the consent that was given', async () => {
      const user = userEvent.setup();
      const { auth } = renderLogin();
      await user.click(switchButton('Crear cuenta'));
      await user.click(consent());

      await user.type(screen.getByLabelText('Nombre completo'), 'Ana Perez');
      await user.type(screen.getByLabelText('Correo'), 'ana@example.test');
      await user.type(screen.getByLabelText('Contraseña'), 'abcdefg1');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Te enviamos un correo');
      expect(auth.signUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Google', () => {
    it('is not offered while the backend has Google off', async () => {
      renderLogin();

      await screen.findByLabelText('Correo');
      expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
    });

    it('is offered below the form once the backend has Google on, and waits for the consent', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: fakeAuth({ getProviders: vi.fn(async () => ok({ google: true })) }) });

      const google = await screen.findByRole('button', { name: 'Continuar con Google' });
      expect(google).toBeDisabled();
      expect(isBefore(consent(), google)).toBe(true);
      expect(isBefore(screen.getByLabelText('Correo'), google)).toBe(true);

      await user.click(consent());
      expect(google).toBeEnabled();
    });
  });

  describe('as a signed-in member', () => {
    it('is sent to the home page instead of seeing the forms', () => {
      renderLogin({
        session: fakeSession({
          status: 'signed-in',
          session: { userId: 'user-1', email: 'ana@example.test' },
          profile: {
            id: 'user-1', fullName: 'Ana Perez', consentVersion: '2026-01-01', consentAt: '2026-10-01T10:00:00+00:00', isAdmin: false,
          },
        }),
      });

      expect(screen.getByText('home page')).toBeInTheDocument();
      expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
    });
  });
});
