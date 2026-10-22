import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import { CURRENT_NOTICE_VERSION } from '../domain/noticeVersion';
import SignUpForm from './SignUpForm';

const ok = (data = { confirmationPending: true }) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function fakeAuth(overrides = {}) {
  return { signUp: vi.fn(async () => ok()), ...overrides };
}

function tree({ consentAccepted, services, consentField }) {
  return (
    <MemoryRouter>
      <BackendContext.Provider value={{ enabled: true, services }}>
        <SignUpForm consentAccepted={consentAccepted} consentField={consentField} />
      </BackendContext.Provider>
    </MemoryRouter>
  );
}

function renderForm({
  auth = fakeAuth(), consentAccepted = true, services = { auth }, consentField,
} = {}) {
  const view = render(tree({ consentAccepted, services, consentField }));
  return { auth, ...view };
}

const fullName = () => screen.getByLabelText('Nombre completo');
const email = () => screen.getByLabelText('Correo');
const password = () => screen.getByLabelText('Contraseña');
const submit = () => screen.getByRole('button', { name: 'Crear cuenta' });

async function fill(user, {
  name = 'Ana Perez', mail = 'ana@example.test', pass = 'abcdefg1',
} = {}) {
  await user.type(fullName(), name);
  await user.type(email(), mail);
  await user.type(password(), pass);
}

describe('SignUpForm', () => {
  it('has labelled name, email and password fields and a button', () => {
    renderForm();

    expect(fullName()).toHaveAttribute('type', 'text');
    expect(fullName()).toHaveAttribute('autocomplete', 'name');
    expect(fullName()).toHaveAttribute('maxlength', '120');
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'new-password');
    expect(submit()).toBeEnabled();
  });

  it('states the password rule next to the field, before anything goes wrong', () => {
    renderForm();

    expect(password()).toHaveAccessibleDescription('Mínimo 8 caracteres, con letras y números.');
    expect(password()).toBeValid();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = renderForm({ services: null });

    expect(container).toBeEmptyDOMElement();
  });

  // The page hands over the consent checkbox, and the form puts it at its end, right
  // before the button it gates: the last thing the member decides before sending.
  describe('the consent field the page hands over', () => {
    const field = <input type="checkbox" aria-label="Acepto" />;

    it('draws it inside the form, after the password and right before the button', () => {
      renderForm({ consentField: field });

      const box = screen.getByRole('checkbox', { name: 'Acepto' });
      expect(box.closest('form')).toContainElement(submit());
      expect(box.compareDocumentPosition(submit())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(password().compareDocumentPosition(box)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(submit().previousElementSibling).toBe(box);
    });

    it('is reached by the keyboard after the password and before the button', async () => {
      const user = userEvent.setup();
      renderForm({ consentField: field });

      await user.click(fullName());
      await user.tab();
      await user.tab();
      expect(password()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('checkbox', { name: 'Acepto' })).toHaveFocus();
      await user.tab();
      expect(submit()).toHaveFocus();
    });

    it('draws nothing of its own when the page hands over none', () => {
      renderForm();

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(submit().previousElementSibling).toBe(
        screen.getByLabelText('Contraseña').closest('.auth-field'),
      );
    });
  });

  describe('consent', () => {
    it('keeps the button disabled until the consent is given', () => {
      const { auth, rerender } = renderForm({ consentAccepted: false });

      expect(submit()).toBeDisabled();

      rerender(tree({ consentAccepted: true, services: { auth } }));
      expect(submit()).toBeEnabled();
    });

    it('does not start a sign-up without the consent even when the form is submitted directly', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm({ consentAccepted: false });
      await fill(user);

      fireEvent.submit(submit().closest('form'));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('Acepta el Aviso de privacidad para continuar.');
      expect(auth.signUp).not.toHaveBeenCalled();
    });
  });

  describe('the sign-up request', () => {
    it('sends the trimmed name, the accepted notice version and the callback address', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fill(user, { name: '  Ana Perez  ' });
      await user.click(submit());

      expect(auth.signUp).toHaveBeenCalledTimes(1);
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'ana@example.test',
        password: 'abcdefg1',
        fullName: 'Ana Perez',
        consentVersion: CURRENT_NOTICE_VERSION,
        redirectTo: `${window.location.origin}/auth/callback`,
      });
    });

    it('sends the password exactly as typed', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fill(user, { pass: ' abc def1 ' });
      await user.click(submit());

      expect(auth.signUp.mock.calls[0][0].password).toBe(' abc def1 ');
    });
  });

  describe('after a successful sign-up', () => {
    it('asks the member to check their email, and the form is gone', async () => {
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(submit());

      const status = await screen.findByRole('status');
      expect(status).toHaveTextContent(
        'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.',
      );
      expect(status).toHaveFocus();
      expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument();
    });

    it('says the same thing whatever the adapter reports about the confirmation', async () => {
      const user = userEvent.setup();
      const signUp = vi.fn(async () => ok({ confirmationPending: false }));
      renderForm({ auth: fakeAuth({ signUp }) });

      await fill(user);
      await user.click(submit());

      expect(await screen.findByRole('status')).toHaveTextContent('Te enviamos un correo');
    });
  });

  describe('when the fields are not valid', () => {
    it('asks for the name', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fill(user, { name: '   ' });
      await user.click(submit());

      expect(fullName()).toBeInvalid();
      expect(fullName()).toHaveAccessibleDescription('Escribe tu nombre completo.');
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it('refuses a name longer than the database accepts', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();
      await user.type(email(), 'ana@example.test');
      await user.type(password(), 'abcdefg1');

      fireEvent.change(fullName(), { target: { value: 'a'.repeat(121) } });
      await user.click(submit());

      expect(fullName()).toHaveAccessibleDescription('El nombre puede tener hasta 120 caracteres.');
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it('explains a malformed email', async () => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fill(user, { mail: 'ana.example.test' });
      await user.click(submit());

      expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
      expect(fullName()).toBeValid();
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it.each([
      ['is too short', 'abc1', 'La contraseña es muy corta.'],
      ['has no digit', 'abcdefgh', 'La contraseña debe incluir letras y números.'],
      ['has no letter', '12345678', 'La contraseña debe incluir letras y números.'],
    ])('explains a password that %s, next to the rule', async (_label, pass, message) => {
      const user = userEvent.setup();
      const { auth } = renderForm();

      await fill(user, { pass });
      await user.click(submit());

      expect(password()).toBeInvalid();
      expect(password()).toHaveAccessibleDescription(
        `Mínimo 8 caracteres, con letras y números. ${message}`,
      );
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it('shows every problem at once and focuses the first field with one', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(submit());

      expect(fullName()).toHaveAccessibleDescription('Escribe tu nombre completo.');
      expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
      expect(password()).toHaveAccessibleDescription(
        'Mínimo 8 caracteres, con letras y números. La contraseña es muy corta.',
      );
      expect(fullName()).toHaveFocus();
    });

    it('focuses the email when the name is fine', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(fullName(), 'Ana Perez');
      await user.click(submit());

      expect(email()).toHaveFocus();
    });

    it('focuses the password when it is the only one wrong', async () => {
      const user = userEvent.setup();
      renderForm();

      await fill(user, { pass: 'abc' });
      await user.click(submit());

      expect(password()).toHaveFocus();
    });

    it('clears the messages once everything is right', async () => {
      const user = userEvent.setup();
      renderForm();
      await user.click(submit());

      await fill(user);
      await user.click(submit());

      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when the backend refuses', () => {
    it.each([
      ['WEAK_PASSWORD', 'La contraseña debe tener al menos 8 caracteres, con letras y números.'],
      ['RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
      ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
      ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
    ])('shows the message of %s in an alert, nothing the backend said, and keeps what was typed', async (code, message) => {
      const user = userEvent.setup();
      renderForm({
        auth: fakeAuth({
          signUp: vi.fn(async () => fail(code, { message: 'raw failure ana@example.test' })),
        }),
      });

      await fill(user);
      await user.click(submit());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('raw failure');
      expect(alert).not.toHaveTextContent('ana@example.test');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(fullName()).toHaveValue('Ana Perez');
      expect(email()).toHaveValue('ana@example.test');
      expect(submit()).toBeEnabled();
    });

    it('shows the generic message and works again when the call rejects', async () => {
      const user = userEvent.setup();
      renderForm({
        auth: fakeAuth({ signUp: vi.fn(async () => { throw new Error('raw failure'); }) }),
      });

      await fill(user);
      await user.click(submit());

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos completar la acción. Inténtalo de nuevo.');
      expect(submit()).toBeEnabled();
    });

    it('lets the member try again', async () => {
      const user = userEvent.setup();
      const signUp = vi.fn()
        .mockResolvedValueOnce(fail('NETWORK'))
        .mockResolvedValueOnce(ok());
      renderForm({ auth: fakeAuth({ signUp }) });
      await fill(user);
      await user.click(submit());
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.click(submit());

      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(signUp).toHaveBeenCalledTimes(2);
    });
  });

  it('disables the button while the call runs', async () => {
    const user = userEvent.setup();
    let release;
    const signUp = vi.fn(() => new Promise((resolve) => { release = () => resolve(fail('NETWORK')); }));
    renderForm({ auth: fakeAuth({ signUp }) });
    await fill(user);

    await user.click(submit());

    expect(submit()).toBeDisabled();
    await act(async () => { release(); });
    await waitFor(() => expect(submit()).toBeEnabled());
  });
});
