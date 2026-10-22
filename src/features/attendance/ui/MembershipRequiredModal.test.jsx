import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider, { useAttendance } from '../composition/AttendanceProvider';
import MembershipRequiredModal from './MembershipRequiredModal';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const WHATSAPP = 'https://wa.me/51960507583';
const TITLE = 'Necesitas una membresía activa';
const TEXT = 'Para confirmar tu asistencia, primero matricúlate. '
  + 'Escríbenos por WhatsApp y te ayudamos con el pago.';

const ok = (data) => ({ ok: true, data });

const services = () => ({
  attendance: {
    listOwnConfirmations: vi.fn(async () => ok([])),
    confirm: vi.fn(async () => ok(null)),
    cancel: vi.fn(async () => ok(null)),
  },
  membership: { listOwnPeriods: vi.fn(async () => ok([])) },
});

const session = { status: 'signed-in', session: { userId: USER }, profile: { id: USER, isAdmin: false } };

// A card's check: it opens the prompt and hands over itself, to get the focus back.
function Opener() {
  const { openPrompt } = useAttendance();
  return <button type="button" onClick={(event) => openPrompt(event.currentTarget)}>Abrir</button>;
}

async function renderModal({ whatsappLink = WHATSAPP, backend = services() } = {}) {
  const view = render(
    <BackendContext.Provider value={{ enabled: true, services: backend }}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          <Opener />
          <MembershipRequiredModal whatsappLink={whatsappLink} />
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return { ...view, backend };
}

const open = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Abrir' }));
};
const dialog = () => screen.getByRole('dialog');

describe('MembershipRequiredModal', () => {
  it('draws nothing while it is closed, not even the host of the portal', async () => {
    await renderModal();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.modal')).toBeNull();
  });

  describe('when it is open', () => {
    it('is a modal dialog with a label and a description', async () => {
      const user = userEvent.setup();
      await renderModal();

      await open(user);

      expect(dialog()).toHaveAttribute('aria-modal', 'true');
      expect(dialog()).toHaveAccessibleName(TITLE);
      expect(dialog()).toHaveAccessibleDescription(TEXT);
      expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
      expect(screen.getByText(TEXT)).toBeInTheDocument();
    });

    it('links to WhatsApp, in a new tab', async () => {
      const user = userEvent.setup();
      await renderModal();

      await open(user);

      const link = screen.getByRole('link', { name: 'Escríbenos por WhatsApp' });
      expect(link).toHaveAttribute('href', WHATSAPP);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });

    it('shows the text without the link when the studio has no WhatsApp', async () => {
      const user = userEvent.setup();
      await renderModal({ whatsappLink: null });

      await open(user);

      expect(screen.getByText(TEXT)).toBeInTheDocument();
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('moves the focus inside, to the close button', async () => {
      const user = userEvent.setup();
      await renderModal();

      await open(user);

      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    });

    it('keeps the focus inside: Tab goes round the link and the close button', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);

      await user.tab();
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveFocus();
    });

    it('calls no adapter, because it only asks the member to enrol', async () => {
      const user = userEvent.setup();
      const { backend } = await renderModal();

      await open(user);

      expect(backend.attendance.confirm).not.toHaveBeenCalled();
      expect(backend.attendance.cancel).not.toHaveBeenCalled();
    });

    it('has no style attribute, because the CSP allows none', async () => {
      const user = userEvent.setup();
      await renderModal();

      await open(user);

      expect(document.querySelector('[style]')).toBeNull();
    });
  });

  describe('closing', () => {
    it('closes with Escape and gives the focus back to the button that opened it', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    });

    it('closes with its button and gives the focus back', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    });

    it('closes by clicking away, on the scrim', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    });

    it('opens again after it was closed', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);
      await user.keyboard('{Escape}');

      await open(user);

      expect(dialog()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    });

    it('stops listening for Escape once it is closed', async () => {
      const user = userEvent.setup();
      await renderModal();
      await open(user);
      await user.keyboard('{Escape}');
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();

      await user.keyboard('{Escape}');

      expect(other).toHaveFocus();
      other.remove();
    });
  });
});
