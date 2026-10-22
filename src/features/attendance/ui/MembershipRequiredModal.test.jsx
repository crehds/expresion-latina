import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';

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
function Opener({ second = false }) {
  const { openPrompt } = useAttendance();
  return (
    <>
      <button type="button" onClick={(event) => openPrompt(event.currentTarget)}>Abrir</button>
      {second && (
        <button type="button" onClick={(event) => openPrompt(event.currentTarget)}>Abrir otra</button>
      )}
    </>
  );
}

Opener.propTypes = { second: PropTypes.bool };

async function renderModal({ whatsappLink = WHATSAPP, backend = services(), second = false } = {}) {
  const view = render(
    <BackendContext.Provider value={{ enabled: true, services: backend }}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          <Opener second={second} />
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

    // The trap holds from any point, not only from the first and the last stop: a
    // click on the text leaves the focus on the page behind, and Tab must not escape.
    describe('keeps the focus inside from anywhere', () => {
      it('goes to the close button on Tab after a click on the text of the dialog', async () => {
        const user = userEvent.setup();
        await renderModal();
        await open(user);

        await user.click(screen.getByText(TEXT));
        // The click left the focus on the dialog itself, which is not one of its stops.
        expect(document.activeElement).toBe(dialog());
        await user.tab();

        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
      });

      it('goes to the last stop on Shift+Tab after a click on the text of the dialog', async () => {
        const user = userEvent.setup();
        await renderModal();
        await open(user);

        await user.click(screen.getByText(TEXT));
        await user.tab({ shift: true });

        expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveFocus();
      });

      it('goes in from a control outside the dialog, in both directions', async () => {
        const user = userEvent.setup();
        await renderModal();
        await open(user);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        outside.focus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

        outside.focus();
        await user.tab({ shift: true });
        expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveFocus();
        outside.remove();
      });

      it('goes in from the dialog container itself', async () => {
        const user = userEvent.setup();
        await renderModal();
        await open(user);

        dialog().focus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

        dialog().focus();
        await user.tab({ shift: true });
        expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveFocus();
      });

      it('keeps going round when there is no link, with the close button as the only stop', async () => {
        const user = userEvent.setup();
        await renderModal({ whatsappLink: null });
        await open(user);

        await user.click(screen.getByText(TEXT));
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
      });
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

    it('gives the focus back to the latest opener when it was opened again meanwhile', async () => {
      const user = userEvent.setup();
      await renderModal({ second: true });
      await user.click(screen.getByRole('button', { name: 'Abrir' }));
      const second = screen.getByRole('button', { name: 'Abrir otra' });
      // A second tap, from another check, while the dialog is open (a script, or a
      // refusal that arrives late): the focus goes back to the last one.
      act(() => second.click());

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(second).toHaveFocus();
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
