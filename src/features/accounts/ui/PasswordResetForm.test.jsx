import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackendContext from '../../../shared/backend/BackendContext';
import PasswordResetForm from './PasswordResetForm';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function renderForm({ requestPasswordReset = vi.fn(async () => ok()) } = {}) {
  render(
    <BackendContext.Provider
      value={{ enabled: true, services: { auth: { requestPasswordReset } } }}
    >
      <PasswordResetForm />
    </BackendContext.Provider>,
  );
  return { requestPasswordReset };
}

const email = () => screen.getByLabelText('Correo');
const submit = () => screen.getByRole('button', { name: 'Enviar enlace' });
const SENT = 'Si existe una cuenta con ese correo, '
  + 'te enviamos un enlace para restablecer tu contraseña.';

describe('PasswordResetForm', () => {
  it('has a labelled email field and the button', () => {
    renderForm();

    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(submit()).toBeEnabled();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = render(
      <BackendContext.Provider value={{ enabled: false, services: null }}>
        <PasswordResetForm />
      </BackendContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for the link with the address as typed and then shows the neutral message in place of the form', async () => {
    const user = userEvent.setup();
    const { requestPasswordReset } = renderForm();

    await user.type(email(), 'ana@example.test');
    await user.click(submit());

    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'ana@example.test' });
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('explains a malformed address and makes no call', async () => {
    const user = userEvent.setup();
    const { requestPasswordReset } = renderForm();

    await user.type(email(), 'ana.example.test');
    await user.click(submit());

    expect(email()).toBeInvalid();
    expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
    expect(email()).toHaveFocus();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
    ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
  ])('shows the message of %s in an alert, keeps the form, says nothing of the account', async (code, message) => {
    const user = userEvent.setup();
    renderForm({
      requestPasswordReset: vi.fn(async () => fail(code, { message: 'raw failure ana@example.test' })),
    });

    await user.type(email(), 'ana@example.test');
    await user.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('raw failure');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(email()).toHaveValue('ana@example.test');
    expect(submit()).toBeEnabled();
  });

  it('disables the button while the call runs', async () => {
    const user = userEvent.setup();
    let release;
    renderForm({
      requestPasswordReset: vi.fn(
        () => new Promise((resolve) => { release = () => resolve(ok()); }),
      ),
    });

    await user.type(email(), 'ana@example.test');
    await user.click(submit());

    expect(submit()).toBeDisabled();
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});
