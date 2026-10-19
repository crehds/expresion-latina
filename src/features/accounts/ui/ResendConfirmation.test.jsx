import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackendContext from '../../../shared/backend/BackendContext';
import ResendConfirmation from './ResendConfirmation';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function renderPiece({
  resendConfirmation = vi.fn(async () => ok()),
  initialEmail = undefined,
} = {}) {
  render(
    <BackendContext.Provider value={{ enabled: true, services: { auth: { resendConfirmation } } }}>
      <ResendConfirmation initialEmail={initialEmail} />
    </BackendContext.Provider>,
  );
  return { resendConfirmation };
}

const email = () => screen.getByLabelText('Correo');
const submit = () => screen.getByRole('button', { name: 'Reenviar correo de confirmación' });
const SENT = 'Si tu cuenta está pendiente de confirmación, te enviamos un nuevo correo.';

describe('ResendConfirmation', () => {
  it('starts with the address it is given', () => {
    renderPiece({ initialEmail: 'ana@example.test' });

    expect(email()).toHaveValue('ana@example.test');
  });

  it('starts empty when it is given no address', () => {
    renderPiece();

    expect(email()).toHaveValue('');
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = render(
      <BackendContext.Provider value={{ enabled: false, services: null }}>
        <ResendConfirmation />
      </BackendContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for a new email for the typed address and shows the neutral message', async () => {
    const user = userEvent.setup();
    const { resendConfirmation } = renderPiece({ initialEmail: 'ana@example.test' });

    await user.click(submit());

    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(resendConfirmation).toHaveBeenCalledTimes(1);
    // Only the address: the confirmation template decides where the link points.
    expect(resendConfirmation).toHaveBeenCalledWith({ email: 'ana@example.test' });
    expect(screen.queryByRole('button', { name: 'Reenviar correo de confirmación' }))
      .not.toBeInTheDocument();
  });

  it('explains a malformed address and makes no call', async () => {
    const user = userEvent.setup();
    const { resendConfirmation } = renderPiece();

    await user.type(email(), 'ana.example.test');
    await user.click(submit());

    expect(email()).toHaveAccessibleDescription('Escribe un correo válido.');
    expect(resendConfirmation).not.toHaveBeenCalled();
  });

  it.each([
    ['RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
    ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
  ])('shows the message of %s in an alert and keeps the button for another try', async (code, message) => {
    const user = userEvent.setup();
    renderPiece({
      initialEmail: 'ana@example.test',
      resendConfirmation: vi.fn(async () => fail(code, { message: 'raw failure' })),
    });

    await user.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('raw failure');
    expect(submit()).toBeEnabled();
  });
});
