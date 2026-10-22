import {
  act, render, screen, waitFor,
} from '@testing-library/react';
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
    requestPasswordReset: vi.fn(async () => ok()),
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

function renderLogin({
  auth = fakeAuth(),
  session = fakeSession(),
  entry = '/login',
} = {}) {
  render(
    <MemoryRouter initialEntries={[entry]}>
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

const CONSENT = { name: /Leí y acepto el Aviso de privacidad/ };
const consent = () => screen.getByRole('checkbox', CONSENT);
const googleOn = () => fakeAuth({ getProviders: vi.fn(async () => ok({ google: true })) });

// Lets the answer about the providers reach the screen, so that something that is
// not there is not simply something that has not come yet.
async function providersAnswered(auth) {
  await waitFor(() => expect(auth.getProviders).toHaveBeenCalledTimes(1));
  await act(async () => {});
}
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

    it('shows no consent checkbox on the sign-in view when Google is off: it would gate nothing', async () => {
      const { auth } = renderLogin();

      await providersAnswered(auth);

      expect(screen.getByLabelText('Correo')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('lets the member sign in without ticking any box: that account already consented', () => {
      renderLogin();

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
      renderLogin({ auth: googleOn() });
      await screen.findByRole('button', { name: 'Continuar con Google' });
      await user.click(consent());

      await user.click(switchButton('Crear cuenta'));
      expect(consent()).toBeChecked();

      await user.click(switchButton('Ingresar'));
      expect(consent()).toBeChecked();
    });

    // Owner: "el acepto debe estar al final y antes de crear cuenta".
    it('puts the consent checkbox, unchecked, at the end of the sign-up form, right before "Crear cuenta"', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(switchButton('Crear cuenta'));

      const submit = screen.getByRole('button', { name: 'Crear cuenta' });
      expect(consent()).not.toBeChecked();
      expect(isBefore(screen.getByLabelText('Contraseña'), consent())).toBe(true);
      expect(isBefore(consent(), submit)).toBe(true);
      expect(consent().closest('form')).toContainElement(submit);
      expect(consent().closest('label').nextElementSibling).toBe(submit);
    });

    it('goes through the sign-up form with the keyboard: the box, its link and then the button', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(switchButton('Crear cuenta'));

      await user.click(screen.getByLabelText('Nombre completo'));
      await user.tab();
      await user.tab();
      expect(screen.getByLabelText('Contraseña')).toHaveFocus();
      await user.tab();
      expect(consent()).toHaveFocus();
      await user.keyboard(' ');
      expect(consent()).toBeChecked();
      // The words "Aviso de privacidad" are a link, so it takes a stop of its own.
      await user.tab();
      expect(screen.getByRole('link', { name: 'Aviso de privacidad' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toHaveFocus();
    });

    it('still gates "Continuar con Google" on the sign-up view, which stays below the form', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: googleOn() });
      await screen.findByRole('button', { name: 'Continuar con Google' });
      await user.click(switchButton('Crear cuenta'));

      const google = screen.getByRole('button', { name: 'Continuar con Google' });
      expect(isBefore(screen.getByRole('button', { name: 'Crear cuenta' }), google)).toBe(true);
      expect(google).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();

      await user.click(consent());

      expect(google).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
    });

    it('shows the consent checkbox once on the sign-up view, Google on or off', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: googleOn() });
      await screen.findByRole('button', { name: 'Continuar con Google' });
      await user.click(switchButton('Crear cuenta'));

      expect(screen.getAllByRole('checkbox', CONSENT)).toHaveLength(1);
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

  describe('forgotten password', () => {
    const forgot = () => screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' });

    it('offers the way to it under the sign-in form, and not on the sign-up form', async () => {
      const user = userEvent.setup();
      renderLogin();

      expect(isBefore(screen.getByLabelText('Contraseña'), forgot())).toBe(true);

      await user.click(switchButton('Crear cuenta'));

      expect(screen.queryByRole('button', { name: '¿Olvidaste tu contraseña?' }))
        .not.toBeInTheDocument();
    });

    it('swaps the sign-in for the reset request, without the consent box or Google', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: googleOn() });
      await screen.findByRole('button', { name: 'Continuar con Google' });

      await user.click(forgot());

      expect(screen.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }))
        .toBeInTheDocument();
      expect(screen.getByLabelText('Correo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
    });

    it('asks for the link and answers the same way for any address', async () => {
      const user = userEvent.setup();
      const { auth } = renderLogin();
      await user.click(forgot());

      await user.type(screen.getByLabelText('Correo'), 'ana@example.test');
      await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.',
      );
      expect(auth.requestPasswordReset).toHaveBeenCalledWith({ email: 'ana@example.test' });
    });

    it('goes back to the sign-in form', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.click(forgot());

      await user.click(switchButton('Ingresar'));

      expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeInTheDocument();
      expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('opens on the reset request when an expired link sent the member here for a new one', () => {
      const entry = { pathname: '/login', state: { forgotPassword: true } };
      renderLogin({ entry });

      expect(screen.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }))
        .toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument();
    });
  });

  describe('Google', () => {
    it('is not offered while the backend has Google off', async () => {
      const { auth } = renderLogin();

      await providersAnswered(auth);

      expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
    });

    it('is offered below the form once the backend has Google on, with its consent box right above it', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: googleOn() });

      const google = await screen.findByRole('button', { name: 'Continuar con Google' });
      expect(google).toBeDisabled();
      expect(isBefore(screen.getByLabelText('Correo'), consent())).toBe(true);
      expect(isBefore(consent(), google)).toBe(true);

      await user.click(consent());
      expect(google).toBeEnabled();
    });

    it('shows the consent box on the sign-in view only together with the button', async () => {
      const { auth } = renderLogin({
        auth: fakeAuth({ getProviders: vi.fn(() => new Promise(() => {})) }),
      });

      await waitFor(() => expect(auth.getProviders).toHaveBeenCalledTimes(1));
      await act(async () => {});

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
    });

    it('gates the button on the sign-up view with the box above that form', async () => {
      const user = userEvent.setup();
      renderLogin({ auth: googleOn() });
      await screen.findByRole('button', { name: 'Continuar con Google' });
      await user.click(switchButton('Crear cuenta'));

      expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeDisabled();
      await user.click(consent());
      expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
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
