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
const TEXT = 'Para confirmar tu asistencia, primero matricúlate. Escríbenos por WhatsApp.';
const TEXT_WITHOUT_LINK = 'Para confirmar tu asistencia, primero matricúlate.';

// Tuesday 2026-10-20, 10:00 in Lima: what the prompt judges the periods against.
const NOW = new Date('2026-10-20T15:00:00Z');

const ok = (data) => ({ ok: true, data });

const services = (periods = []) => ({
  attendance: {
    listOwnConfirmations: vi.fn(async () => ok([])),
    confirm: vi.fn(async () => ok(null)),
    cancel: vi.fn(async () => ok(null)),
  },
  membership: { listOwnPeriods: vi.fn(async () => ok(periods)) },
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

async function renderModal({
  whatsappLink = WHATSAPP, periods = [], backend = services(periods), second = false,
} = {}) {
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
  // Only the date is judged against the clock, so the clock is fixed and the timers stay
  // real for the focus and the keys.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

    it('shows the text without the link, and without the sentence about WhatsApp, when the studio has none', async () => {
      const user = userEvent.setup();
      await renderModal({ whatsappLink: null });

      await open(user);

      expect(screen.getByText(TEXT_WITHOUT_LINK)).toBeInTheDocument();
      expect(screen.queryByText(/WhatsApp/)).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('no longer promises help with the payment (the owner took that out)', async () => {
      const user = userEvent.setup();
      await renderModal();

      await open(user);

      expect(dialog()).not.toHaveTextContent('pago');
    });

    // Option A (owner): a member whose membership starts later asks for an earlier start,
    // and the admin moves the dates. The same dialog says so.
    describe('for a member whose membership starts later', () => {
      const LATER = [{ startsOn: '2026-11-03', endsOn: '2026-12-02' }];
      const STARTS = 'Tu membresía empieza el 3 de noviembre de 2026';

      it('says the day it starts, in the title, and how to ask for an earlier start', async () => {
        const user = userEvent.setup();
        await renderModal({ periods: LATER });

        await open(user);

        expect(dialog()).toHaveAccessibleName(STARTS);
        expect(screen.getByRole('heading', { level: 2, name: STARTS })).toBeInTheDocument();
        expect(dialog()).toHaveAccessibleDescription('Si quieres empezar antes, escríbenos por WhatsApp.');
        expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' }))
          .toHaveAttribute('href', WHATSAPP);
        expect(screen.queryByText(/Necesitas una membresía activa/)).toBeNull();
      });

      it('sends them to the academy when the studio has no WhatsApp', async () => {
        const user = userEvent.setup();
        await renderModal({ periods: LATER, whatsappLink: null });

        await open(user);

        expect(dialog()).toHaveAccessibleName(STARTS);
        expect(screen.getByText('Si quieres empezar antes, acércate a la academia.')).toBeInTheDocument();
        expect(screen.queryByRole('link')).toBeNull();
      });

      it('gives the earliest start when there are several', async () => {
        const user = userEvent.setup();
        await renderModal({
          periods: [
            { startsOn: '2026-12-10', endsOn: '2027-01-09' },
            { startsOn: '2026-11-03', endsOn: '2026-12-02' },
          ],
        });

        await open(user);

        expect(dialog()).toHaveAccessibleName(STARTS);
      });

      it('asks to enrol, as before, when the only periods are past ones', async () => {
        const user = userEvent.setup();
        await renderModal({ periods: [{ startsOn: '2026-08-01', endsOn: '2026-09-30' }] });

        await open(user);

        expect(dialog()).toHaveAccessibleName(TITLE);
      });
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

        await user.click(screen.getByText(TEXT_WITHOUT_LINK));
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
