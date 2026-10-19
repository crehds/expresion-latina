import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackendContext from '../../../shared/backend/BackendContext';
import NewPassword from './NewPassword';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

function renderForm({
  updatePassword = vi.fn(async () => ok()),
  signOutOthers = vi.fn(async () => ok()),
  onDone = vi.fn(),
} = {}) {
  render(
    <BackendContext.Provider
      value={{ enabled: true, services: { auth: { updatePassword, signOutOthers } } }}
    >
      <NewPassword onDone={onDone} />
    </BackendContext.Provider>,
  );
  return { updatePassword, signOutOthers, onDone };
}

const password = () => screen.getByLabelText('Nueva contraseña');
const confirmation = () => screen.getByLabelText('Repite la contraseña');
const submit = () => screen.getByRole('button', { name: 'Cambiar contraseña' });

async function fillAndSubmit(user, { first = 'abcdefg2', second = first } = {}) {
  await user.type(password(), first);
  await user.type(confirmation(), second);
  await user.click(submit());
}

describe('NewPassword', () => {
  it('has two labelled new-password fields, the same visible hint as the sign-up and the button', () => {
    renderForm();

    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmation()).toHaveAttribute('type', 'password');
    expect(confirmation()).toHaveAttribute('autocomplete', 'new-password');
    expect(password()).toHaveAccessibleDescription('Mínimo 8 caracteres, con letras y números.');
    expect(submit()).toBeEnabled();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = render(
      <BackendContext.Provider value={{ enabled: false, services: null }}>
        <NewPassword onDone={vi.fn()} />
      </BackendContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('sends the password as typed, once, and tells the parent when it is done', async () => {
    const user = userEvent.setup();
    const { updatePassword, onDone } = renderForm();

    await fillAndSubmit(user, { first: ' abc def2 ' });

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(updatePassword).toHaveBeenCalledTimes(1);
    expect(updatePassword).toHaveBeenCalledWith({ password: ' abc def2 ' });
  });

  describe('after the password changed', () => {
    it('signs the other devices out, after the change and before telling the parent', async () => {
      const user = userEvent.setup();
      const calls = [];
      const { signOutOthers, onDone } = renderForm({
        updatePassword: vi.fn(async () => { calls.push('updatePassword'); return ok(); }),
        signOutOthers: vi.fn(async () => { calls.push('signOutOthers'); return ok(); }),
        onDone: vi.fn(() => calls.push('onDone')),
      });

      await fillAndSubmit(user);

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(signOutOthers).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['updatePassword', 'signOutOthers', 'onDone']);
    });

    it.each([
      ['a failed result', vi.fn(async () => fail('NETWORK'))],
      ['a rejection', vi.fn(async () => { throw new Error('offline'); })],
    ])('is still a success when signing the other devices out ends in %s', async (_name, signOutOthers) => {
      const user = userEvent.setup();
      const { onDone } = renderForm({ signOutOthers });

      await fillAndSubmit(user);

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(signOutOthers).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('signs nobody out when the password did not change', async () => {
      const user = userEvent.setup();
      const { signOutOthers } = renderForm({
        updatePassword: vi.fn(async () => fail('SAME_PASSWORD')),
      });

      await fillAndSubmit(user);

      await screen.findByRole('alert');
      expect(signOutOthers).not.toHaveBeenCalled();
    });
  });

  describe('when the fields are not valid', () => {
    it('explains a short password, ties the message to the field and makes no call', async () => {
      const user = userEvent.setup();
      const { updatePassword, onDone } = renderForm();

      await fillAndSubmit(user, { first: 'abc1' });

      expect(password()).toBeInvalid();
      expect(password()).toHaveAccessibleDescription(/La contraseña es muy corta\./);
      expect(updatePassword).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
      expect(password()).toHaveFocus();
    });

    it('explains a password with no digit', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillAndSubmit(user, { first: 'abcdefgh' });

      expect(password()).toHaveAccessibleDescription(/debe incluir letras y números/);
    });

    it('explains two passwords that differ and focuses the second one', async () => {
      const user = userEvent.setup();
      const { updatePassword } = renderForm();

      await fillAndSubmit(user, { first: 'abcdefg2', second: 'abcdefg3' });

      expect(confirmation()).toBeInvalid();
      expect(confirmation()).toHaveAccessibleDescription('Las contraseñas no coinciden.');
      expect(confirmation()).toHaveFocus();
      expect(password()).toBeValid();
      expect(updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('when the backend refuses', () => {
    it.each([
      ['SAME_PASSWORD', 'La nueva contraseña debe ser distinta de la actual.'],
      ['WEAK_PASSWORD', 'La contraseña debe tener al menos 8 caracteres, con letras y números.'],
      ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
      ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
    ])('shows the message of %s in an alert, and nothing the backend said', async (code, message) => {
      const user = userEvent.setup();
      const { onDone } = renderForm({
        updatePassword: vi.fn(async () => fail(code, { message: 'raw failure abcdefg2' })),
      });

      await fillAndSubmit(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('raw failure');
      expect(alert).not.toHaveTextContent('abcdefg2');
      expect(onDone).not.toHaveBeenCalled();
      expect(submit()).toBeEnabled();
    });
  });

  it('disables the button while the call runs, so a second press sends nothing', async () => {
    const user = userEvent.setup();
    let release;
    const updatePassword = vi.fn(
      () => new Promise((resolve) => { release = () => resolve(ok()); }),
    );
    renderForm({ updatePassword });

    await fillAndSubmit(user);

    expect(submit()).toBeDisabled();
    await act(async () => { release(); });
    expect(updatePassword).toHaveBeenCalledTimes(1);
  });
});
