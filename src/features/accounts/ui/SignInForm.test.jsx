import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import SessionContext from '../composition/SessionProvider';
import SignInForm from './SignInForm';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function fakeAuth(overrides = {}) {
  return { signInWithPassword: vi.fn(async () => ok()), ...overrides };
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

function renderForm({ auth = fakeAuth(), session = fakeSession() } = {}) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionContext.Provider value={session}>
          <Routes>
            <Route path="/login" element={<SignInForm />} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </SessionContext.Provider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
  return { auth, session };
}

const email = () => screen.getByLabelText('Correo');
const password = () => screen.getByLabelText('Contraseña');
const submit = () => screen.getByRole('button', { name: 'Ingresar' });

async function fillAndSubmit(user, { mail = 'ana@example.test', pass = 'abcdefg1' } = {}) {
  await user.type(email(), mail);
  await user.type(password(), pass);
  await user.click(submit());
}

describe('SignInForm', () => {
  it('has a labelled email field, a labelled password field and the button', () => {
    renderForm();

    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(submit()).toBeEnabled();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = render(
      <MemoryRouter>
        <BackendContext.Provider value={{ enabled: false, services: null }}>
          <SignInForm />
        </BackendContext.Provider>
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('signs in with the credentials as typed, starts the session and goes to the home page', async () => {
    const user = userEvent.setup();
    const { auth, session } = renderForm();

    await fillAndSubmit(user, { pass: ' abc def1 ' });

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.test', password: ' abc def1 ',
    });
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(auth.signInWithPassword.mock.invocationCallOrder[0])
      .toBeLessThan(session.start.mock.invocationCallOrder[0]);
  });

  it('does not touch the session or leave the page when the sign-in fails', async () => {
    const user = userEvent.setup();
    const { session } = renderForm({
      auth: fakeAuth({ signInWithPassword: vi.fn(async () => fail('INVALID_CREDENTIALS')) }),
    });

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(session.start).not.toHaveBeenCalled();
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
    expect(email()).toHaveValue('ana@example.test');
  });

  describe('when the fields are not valid', () => {
    it('explains a malformed email, ties the message to the field and makes no call', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fillAndSubmit(user, { mail: 'ana.example.test' });

      expect(email()).toBeInvalid();
      expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
      expect(password()).toBeValid();
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('asks for the password when it is blank', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fillAndSubmit(user, { pass: '   ' });

      expect(password()).toBeInvalid();
      expect(password()).toHaveAccessibleDescription('Escribe tu contraseña.');
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('shows every problem at once and moves the focus to the first field with one', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(submit());

      expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
      expect(password()).toHaveAccessibleDescription('Escribe tu contraseña.');
      expect(email()).toHaveFocus();
    });

    it('focuses the password when only that one is wrong', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(email(), 'ana@example.test');
      await user.click(submit());

      expect(password()).toHaveFocus();
    });

    it('clears the messages once the fields are right', async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(submit());

      await fillAndSubmit(user);

      expect(await screen.findByText('home page')).toBeInTheDocument();
    });

    it('drops the message of a failed call when the fields are wrong again', async () => {
      const user = userEvent.setup();
      renderForm({
        auth: fakeAuth({ signInWithPassword: vi.fn(async () => fail('NETWORK')) }),
      });
      await fillAndSubmit(user);
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.clear(email());
      await user.click(submit());

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(email()).toBeInvalid();
    });
  });

  describe('when the backend refuses', () => {
    it.each([
      ['INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.'],
      ['EMAIL_NOT_CONFIRMED', 'Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.'],
      ['RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
      ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
      ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
      ['SOMETHING_NEW', 'No pudimos completar la acción. Inténtalo de nuevo.'],
    ])('shows the message of %s in an alert, and nothing the backend said', async (code, message) => {
      const user = userEvent.setup();
      renderForm({
        auth: fakeAuth({
          signInWithPassword: vi.fn(async () => fail(code, { message: 'raw failure ana@example.test' })),
        }),
      });

      await fillAndSubmit(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('raw failure');
      expect(alert).not.toHaveTextContent('ana@example.test');
    });

    it('shows the generic message and works again when the call rejects', async () => {
      const user = userEvent.setup();
      renderForm({
        auth: fakeAuth({
          signInWithPassword: vi.fn(async () => { throw new Error('raw failure'); }),
        }),
      });

      await fillAndSubmit(user);

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos completar la acción. Inténtalo de nuevo.');
      expect(submit()).toBeEnabled();
    });

    it('lets the member try again, and the message goes when the next call starts', async () => {
      const user = userEvent.setup();
      const signInWithPassword = vi.fn()
        .mockResolvedValueOnce(fail('INVALID_CREDENTIALS'))
        .mockResolvedValueOnce(ok());
      renderForm({ auth: fakeAuth({ signInWithPassword }) });
      await fillAndSubmit(user, { pass: 'wrong-pass1' });
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.clear(password());
      await user.type(password(), 'abcdefg1');
      await user.click(submit());

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(signInWithPassword).toHaveBeenCalledTimes(2);
    });
  });

  it('disables the button while the call runs', async () => {
    const user = userEvent.setup();
    let release;
    const signInWithPassword = vi.fn(
      () => new Promise((resolve) => { release = () => resolve(fail('NETWORK')); }),
    );
    renderForm({ auth: fakeAuth({ signInWithPassword }) });

    await fillAndSubmit(user);

    expect(submit()).toBeDisabled();
    await act(async () => { release(); });
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it('keeps the button disabled until the session has started', async () => {
    const user = userEvent.setup();
    let release;
    const start = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    renderForm({ session: fakeSession({ start }) });

    await fillAndSubmit(user);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(submit()).toBeDisabled();
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
    await act(async () => { release(); });
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });
});
