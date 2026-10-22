import {
  act, fireEvent, render, screen,
} from '@testing-library/react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider from '../composition/AttendanceProvider';
import MembershipRequiredModal from './MembershipRequiredModal';
import SessionAttendance from './SessionAttendance';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const WHATSAPP = 'https://wa.me/51960507583';

// Tuesday 2026-10-20, 10:00 in Lima (UTC-05:00).
const NOW = new Date('2026-10-20T15:00:00Z');

const sessionOf = ({
  id, weekday, start, end, genreId, genreName, kind = 'dance',
}) => ({
  id,
  day: { weekday },
  slot: { start, end },
  genre: { id: genreId, name: genreName, kind },
  room: 'Sala 1',
});

// Their next occurrences: Monday 2026-10-26 at 19:00, and today at 18:00.
const MONDAY = sessionOf({
  id: 'lun-1900', weekday: 1, start: '19:00', end: '20:00', genreId: 'salsa', genreName: 'Salsa',
});
const TUESDAY = sessionOf({
  id: 'mar-1800', weekday: 2, start: '18:00', end: '19:00', genreId: 'bachata', genreName: 'Bachata',
});
const REHEARSAL = sessionOf({
  id: 'mie-2030',
  weekday: 3,
  start: '20:30',
  end: '22:00',
  genreId: 'ensayo-elenco',
  genreName: 'Ensayo Elenco',
  kind: 'rehearsal',
});

const MONDAY_OCCURRENCE = {
  classDate: '2026-10-26',
  startTime: '19:00',
  endTime: '20:00',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
};

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

const OPEN_MONTH = [{ startsOn: '2026-10-01', endsOn: '2026-10-31' }];

function fakeServices({ periods = OPEN_MONTH, confirmed = [] } = {}) {
  return {
    attendance: {
      listOwnConfirmations: vi.fn(async () => ok(confirmed)),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: { listOwnPeriods: vi.fn(async () => ok(periods)) },
  };
}

const SIGNED_IN = { status: 'signed-in', session: { userId: USER }, profile: { id: USER } };
const SIGNED_IN_ADMIN = { ...SIGNED_IN, profile: { id: USER, isAdmin: true } };
const SIGNED_OUT = { status: 'signed-out', session: null, profile: null };

async function renderCards(sessions, {
  services = fakeServices(), session = SIGNED_IN, enabled = true, whatsappLink = WHATSAPP,
} = {}) {
  const backend = { enabled, services };
  const view = render(
    <BackendContext.Provider value={backend}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          {sessions.map((one) => (
            <div key={one.id} data-testid={one.id}>
              <SessionAttendance session={one} whatsappLink={whatsappLink} />
            </div>
          ))}
          <MembershipRequiredModal whatsappLink={whatsappLink} />
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return { ...view, services };
}

const card = (id) => screen.getByTestId(id);

// The button of one card, found by its label: the toggle is an icon with no text.
const buttonOf = (id, name) => (
  Array.from(card(id).querySelectorAll('button'))
    .find((button) => button.getAttribute('aria-label') === name)
);

describe('SessionAttendance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('shows nothing', () => {
    it('for a signed-out visitor, and calls no adapter', async () => {
      const { services } = await renderCards([MONDAY], { session: SIGNED_OUT });

      expect(card('lun-1900')).toBeEmptyDOMElement();
      expect(services.membership.listOwnPeriods).not.toHaveBeenCalled();
    });

    it('while the backend is disabled', async () => {
      await renderCards([MONDAY], { enabled: false });

      expect(card('lun-1900')).toBeEmptyDOMElement();
    });

    it('while the data is still loading, so nothing flashes as inactive', async () => {
      const services = fakeServices();
      services.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));

      await renderCards([MONDAY], { services });

      expect(card('lun-1900')).toBeEmptyDOMElement();
    });

    it('on a rehearsal card, for an active member', async () => {
      await renderCards([REHEARSAL]);

      expect(card('mie-2030')).toBeEmptyDOMElement();
    });

    it('on a rehearsal card, for an inactive member too: no control and no message', async () => {
      await renderCards([REHEARSAL], { services: fakeServices({ periods: [] }) });

      expect(card('mie-2030')).toBeEmptyDOMElement();
    });

    it('for a session whose room cannot make a key', async () => {
      await renderCards([{ ...MONDAY, id: 'broken', room: '' }]);

      expect(card('broken')).toBeEmptyDOMElement();
    });
  });

  describe('for an active member', () => {
    it('offers to confirm the next occurrence of the class', async () => {
      await renderCards([MONDAY]);

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeEnabled();
      expect(screen.getByText('Próxima clase: 26 de octubre de 2026')).toBeInTheDocument();
    });

    it('uses today for a class that has not started yet today', async () => {
      await renderCards([TUESDAY]);

      expect(screen.getByText('Próxima clase: 20 de octubre de 2026')).toBeInTheDocument();
    });

    it('confirms that occurrence with no event argument, and then offers to cancel it', async () => {
      const { services } = await renderCards([MONDAY]);

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});

      expect(services.attendance.confirm).toHaveBeenCalledTimes(1);
      const [call] = services.attendance.confirm.mock.calls;
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject(MONDAY_OCCURRENCE);
      expect(call[0].startsAt).toBeInstanceOf(Date);
      expect(screen.getByText('Vas a esta clase')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('cancels that occurrence, and then offers to confirm again', async () => {
      const services = fakeServices({ confirmed: [MONDAY_OCCURRENCE] });
      await renderCards([MONDAY], { services });
      expect(screen.getByText('Vas a esta clase')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar asistencia' }));
      await act(async () => {});

      const [call] = services.attendance.cancel.mock.calls;
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject(MONDAY_OCCURRENCE);
      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByText('Vas a esta clase')).toBeNull();
    });

    it('tells each card its own occurrence apart', async () => {
      const services = fakeServices({ confirmed: [MONDAY_OCCURRENCE] });
      await renderCards([MONDAY, TUESDAY], { services });

      expect(buttonOf('lun-1900', 'Cancelar asistencia')).toBeTruthy();
      expect(buttonOf('mar-1800', 'Confirmar asistencia')).toBeTruthy();
    });

    it('shows a failure on the card that was clicked and on no other', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValue(fail('NETWORK'));
      await renderCards([MONDAY, TUESDAY], { services });

      fireEvent.click(buttonOf('lun-1900', 'Confirmar asistencia'));
      await act(async () => {});

      expect(card('lun-1900').querySelector('[role="alert"]')).toHaveTextContent(
        'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
      );
      expect(card('mar-1800').querySelector('[role="alert"]')).toBeNull();
    });

    it('disables the card while its action is in flight, and not the other card', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockReturnValue(new Promise(() => {}));
      await renderCards([MONDAY, TUESDAY], { services });

      fireEvent.click(buttonOf('lun-1900', 'Confirmar asistencia'));
      await act(async () => {});

      expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBeDisabled();
      expect(buttonOf('mar-1800', 'Confirmar asistencia')).toBeEnabled();
    });

    it('says a cancelled-elsewhere confirmation is simply gone, with no false message', async () => {
      const services = fakeServices({ confirmed: [MONDAY_OCCURRENCE] });
      services.attendance.cancel.mockResolvedValue(fail('STARTED'));
      await renderCards([MONDAY], { services });
      services.attendance.listOwnConfirmations.mockResolvedValue(ok([]));

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar asistencia' }));
      await act(async () => {});

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  // Administrators have free access to classes: the same button as a member,
  // with or without a paid period. The database still bounds the window.
  describe('for an administrator', () => {
    it.each([
      ['no paid period at all', []],
      ['periods that all ended', [{ startsOn: '2026-09-01', endsOn: '2026-09-30' }]],
      ['a period that ends before the class', [{ startsOn: '2026-10-01', endsOn: '2026-10-22' }]],
    ])('offers to confirm with %s, and no message about the membership', async (_label, periods) => {
      await renderCards([MONDAY], {
        services: fakeServices({ periods }), session: SIGNED_IN_ADMIN,
      });

      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeEnabled();
      expect(screen.queryByText('Tu membresía no está activa.')).toBeNull();
      expect(screen.queryByText(/Tu membresía/)).toBeNull();
      expect(screen.queryByRole('link', { name: 'Escríbenos por WhatsApp' })).toBeNull();
    });

    it('confirms with the same call a member makes, and then offers to cancel', async () => {
      const { services } = await renderCards([MONDAY], {
        services: fakeServices({ periods: [] }), session: SIGNED_IN_ADMIN,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});

      expect(services.attendance.confirm).toHaveBeenCalledTimes(1);
      expect(services.attendance.confirm.mock.calls[0][0]).toMatchObject(MONDAY_OCCURRENCE);
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeInTheDocument();
    });

    it('cancels a confirmation, and then offers to confirm again', async () => {
      const services = fakeServices({ periods: [], confirmed: [MONDAY_OCCURRENCE] });
      await renderCards([MONDAY], { services, session: SIGNED_IN_ADMIN });

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar asistencia' }));
      await act(async () => {});

      expect(services.attendance.cancel).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeInTheDocument();
    });

    it('shows a refusal of the database like it does for a member', async () => {
      const services = fakeServices({ periods: [] });
      services.attendance.confirm.mockResolvedValue(fail('FORBIDDEN'));
      await renderCards([MONDAY], { services, session: SIGNED_IN_ADMIN });

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});

      expect(card('lun-1900').querySelector('[role="alert"]')).toBeInTheDocument();
    });

    it('never opens the prompt to enrol, because the free access is theirs', async () => {
      await renderCards([MONDAY], {
        services: fakeServices({ periods: [] }), session: SIGNED_IN_ADMIN,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // The message about the membership is said once, above the schedule
  // (InactiveMembershipNotice). The cards of a member with no active membership show
  // the same check as everyone's (F2b: they used to show nothing, or lose their check
  // when it was tapped), and tapping one asks them to enrol without calling the server.
  describe('for a member whose membership is not active', () => {
    const NO_PERIOD = () => fakeServices({ periods: [] });

    it('shows the check on every card, with no message and no link of its own', async () => {
      await renderCards([MONDAY, TUESDAY], { services: NO_PERIOD() });

      expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBeTruthy();
      expect(buttonOf('mar-1800', 'Confirmar asistencia')).toBeTruthy();
      expect(screen.queryByText(/Tu membresía/)).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the prompt on a tap, calls no server, and keeps every check', async () => {
      const services = NO_PERIOD();
      await renderCards([MONDAY, TUESDAY], { services });

      fireEvent.click(buttonOf('lun-1900', 'Confirmar asistencia'));
      await act(async () => {});

      expect(screen.getByRole('dialog', { name: 'Necesitas una membresía activa' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' }))
        .toHaveAttribute('href', WHATSAPP);
      expect(services.attendance.confirm).not.toHaveBeenCalled();
      expect(services.attendance.cancel).not.toHaveBeenCalled();
      // Nothing was read again either: the card knew from the periods it holds.
      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(1);
      expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBeTruthy();
      expect(buttonOf('mar-1800', 'Confirmar asistencia')).toBeTruthy();
    });

    it('gives the focus back to the check that opened the prompt when it closes', async () => {
      await renderCards([MONDAY, TUESDAY], { services: NO_PERIOD() });
      const check = buttonOf('mar-1800', 'Confirmar asistencia');
      check.focus();

      fireEvent.click(check);
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
      fireEvent.keyDown(document, { key: 'Escape' });
      await act(async () => {});

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(check).toHaveFocus();
    });

    it('shows the text of the prompt alone when the studio has no WhatsApp', async () => {
      await renderCards([MONDAY], { services: NO_PERIOD(), whatsappLink: null });

      fireEvent.click(buttonOf('lun-1900', 'Confirmar asistencia'));
      await act(async () => {});

      expect(screen.getByRole('dialog')).toHaveTextContent('primero matricúlate');
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('treats a period that has not started yet like no membership', async () => {
      const services = fakeServices({ periods: [{ startsOn: '2026-10-21', endsOn: '2026-11-20' }] });
      await renderCards([MONDAY], { services });

      fireEvent.click(buttonOf('lun-1900', 'Confirmar asistencia'));
      await act(async () => {});

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(services.attendance.confirm).not.toHaveBeenCalled();
    });

    it('still lets the member cancel a class they confirmed before the membership lapsed', async () => {
      const services = fakeServices({ periods: [], confirmed: [MONDAY_OCCURRENCE] });
      await renderCards([MONDAY, TUESDAY], { services });
      expect(screen.getByText('Vas a esta clase')).toBeInTheDocument();

      fireEvent.click(buttonOf('lun-1900', 'Cancelar asistencia'));
      await act(async () => {});

      expect(services.attendance.cancel).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      // The card that was cancelled keeps its check, now to be tapped for the prompt.
      expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBeTruthy();
    });

    // F2b, the stale page: it was loaded while the payment existed, the payment was
    // deleted, and the database refuses the confirm. The checks used to vanish.
    describe('when the page was loaded before the payment was deleted', () => {
      async function staleConfirm({ code = 'FORBIDDEN', after = ok([]) } = {}) {
        const services = fakeServices();
        services.attendance.confirm.mockResolvedValue(fail(code));
        await renderCards([MONDAY, TUESDAY], { services });
        services.membership.listOwnPeriods.mockResolvedValue(after);
        const check = buttonOf('lun-1900', 'Confirmar asistencia');
        check.focus();

        fireEvent.click(check);
        await act(async () => {});
        return { services, check };
      }

      it('opens the prompt instead of letting the checks vanish', async () => {
        const { services } = await staleConfirm();

        expect(services.attendance.confirm).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('dialog', { name: 'Necesitas una membresía activa' })).toBeInTheDocument();
        expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBeTruthy();
        expect(buttonOf('mar-1800', 'Confirmar asistencia')).toBeTruthy();
        // The prompt says it, so the card does not also show the refusal.
        expect(screen.queryByRole('alert')).toBeNull();
      });

      it('gives the focus back to the check that was tapped', async () => {
        const { check } = await staleConfirm();

        fireEvent.keyDown(document, { key: 'Escape' });
        await act(async () => {});

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(buttonOf('lun-1900', 'Confirmar asistencia')).toBe(check);
        expect(check).toHaveFocus();
      });

      it('keeps the alert, and no prompt, for any other refusal', async () => {
        await staleConfirm({ code: 'NETWORK' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(card('lun-1900').querySelector('[role="alert"]')).toHaveTextContent(
          'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
        );
      });

      it('keeps the alert when the fresh read says the membership is still active', async () => {
        await staleConfirm({ after: ok(OPEN_MONTH) });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(card('lun-1900').querySelector('[role="alert"]')).toHaveTextContent(
          'No pudimos confirmar tu asistencia. Revisa que tu membresía cubra esa fecha.',
        );
      });
    });
  });

  describe('for a class after the end of the membership', () => {
    it('says the day it runs to, with no button', async () => {
      const services = fakeServices({ periods: [{ startsOn: '2026-10-01', endsOn: '2026-10-24' }] });

      await renderCards([MONDAY], { services });

      expect(screen.getByText('Tu membresía vence el 24 de octubre de 2026.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Escríbenos por WhatsApp' }))
        .toHaveAttribute('href', WHATSAPP);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('stops at a gap: Oct 1-24 and Nov 15-30 give Oct 24, not Nov 30', async () => {
      const services = fakeServices({
        periods: [
          { startsOn: '2026-10-01', endsOn: '2026-10-24' },
          { startsOn: '2026-11-15', endsOn: '2026-11-30' },
        ],
      });

      await renderCards([MONDAY], { services });

      expect(screen.getByText('Tu membresía vence el 24 de octubre de 2026.')).toBeInTheDocument();
    });
  });
});
