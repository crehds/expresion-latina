import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackendContext from '../../../shared/backend/BackendContext';
import SessionContext from '../composition/SessionProvider';
import DeleteAccount from './DeleteAccount';

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

function renderSection({
  deleteMyAccount = vi.fn(async () => ok()),
  signOut = vi.fn(async () => ok()),
  onDeleted = vi.fn(),
} = {}) {
  render(
    <BackendContext.Provider value={{ enabled: true, services: { auth: { deleteMyAccount } } }}>
      <SessionContext.Provider value={{ status: 'signed-in', signOut }}>
        <DeleteAccount onDeleted={onDeleted} />
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  return { deleteMyAccount, signOut, onDeleted };
}

const first = () => screen.getByRole('button', { name: 'Eliminar mi cuenta' });
const confirm = () => screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' });
const cancel = () => screen.getByRole('button', { name: 'Cancelar' });

describe('DeleteAccount', () => {
  it('explains what is erased and cannot be recovered, and asks nothing yet', () => {
    const { deleteMyAccount } = renderSection();

    expect(screen.getByRole('heading', { name: 'Eliminar mi cuenta' })).toBeInTheDocument();
    expect(screen.getByText(/tus pagos registrados y tus confirmaciones de asistencia/)).toBeInTheDocument();
    expect(screen.getByText(/No se pueden recuperar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, eliminar mi cuenta' })).not.toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it('renders nothing while the backend offers no auth service', () => {
    const { container } = render(
      <BackendContext.Provider value={{ enabled: false, services: null }}>
        <DeleteAccount onDeleted={vi.fn()} />
      </BackendContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the confirmation on the first press, moves the focus to it and still deletes nothing', async () => {
    const user = userEvent.setup();
    const { deleteMyAccount } = renderSection();

    await user.click(first());

    const group = screen.getByRole('group', { name: /¿Seguro\?/ });
    expect(group).toHaveFocus();
    expect(confirm()).toBeEnabled();
    expect(cancel()).toBeEnabled();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it('goes back to the first button, with the focus on it, when the member cancels', async () => {
    const user = userEvent.setup();
    const { deleteMyAccount } = renderSection();
    await user.click(first());

    await user.click(cancel());

    expect(screen.queryByRole('button', { name: 'Sí, eliminar mi cuenta' })).not.toBeInTheDocument();
    expect(first()).toHaveFocus();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it('deletes the account, tells the page before it signs out, and does both once', async () => {
    const user = userEvent.setup();
    const calls = [];
    const { deleteMyAccount, signOut, onDeleted } = renderSection({
      deleteMyAccount: vi.fn(async () => { calls.push('deleteMyAccount'); return ok(); }),
      signOut: vi.fn(async () => { calls.push('signOut'); return ok(); }),
      onDeleted: vi.fn(() => calls.push('onDeleted')),
    });
    await user.click(first());

    await user.click(confirm());

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['deleteMyAccount', 'onDeleted', 'signOut']);
  });

  // The provider's signOut resolves to a failure when a session may still be held.
  // The account is gone and the page already says so, so that is not shown.
  it('still tells the page, and shows nothing, when signing out afterwards fails', async () => {
    const user = userEvent.setup();
    const { onDeleted, signOut } = renderSection({
      signOut: vi.fn(async () => fail('NETWORK')),
    });
    await user.click(first());

    await user.click(confirm());

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still tells the page when signing out afterwards rejects', async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderSection({
      signOut: vi.fn(async () => { throw new Error('offline'); }),
    });
    await user.click(first());

    await user.click(confirm());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
    ['UNKNOWN', 'No pudimos completar la acción. Inténtalo de nuevo.'],
  ])('shows the message of %s in an alert and keeps the account and the session', async (code, message) => {
    const user = userEvent.setup();
    const { signOut, onDeleted } = renderSection({
      deleteMyAccount: vi.fn(async () => ({ ...fail(code), message: 'raw failure' })),
    });
    await user.click(first());

    await user.click(confirm());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent('raw failure');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(confirm()).toBeEnabled();
    expect(cancel()).toBeEnabled();
  });

  it('shows the generic message when the deletion rejects', async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderSection({
      deleteMyAccount: vi.fn(async () => { throw new Error('boom'); }),
    });
    await user.click(first());

    await user.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar la acción.');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('disables both buttons while the deletion runs, so a second press sends nothing', async () => {
    const user = userEvent.setup();
    let release;
    const deleteMyAccount = vi.fn(
      () => new Promise((resolve) => { release = () => resolve(ok()); }),
    );
    renderSection({ deleteMyAccount });
    await user.click(first());

    await user.click(confirm());

    expect(confirm()).toBeDisabled();
    expect(cancel()).toBeDisabled();
    await act(async () => { release(); });
    expect(deleteMyAccount).toHaveBeenCalledTimes(1);
  });
});
