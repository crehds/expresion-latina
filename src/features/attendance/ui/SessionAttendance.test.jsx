import {
  act, fireEvent, render, screen,
} from '@testing-library/react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider from '../composition/AttendanceProvider';
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
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return { ...view, services };
}

const card = (id) => screen.getByTestId(id);

// The button of one card, found by its text.
const buttonOf = (id, name) => (
  Array.from(card(id).querySelectorAll('button')).find((button) => button.textContent === name)
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
      expect(screen.getByText('Confirmaste tu asistencia.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar asistencia' })).toBeInTheDocument();
    });

    it('cancels that occurrence, and then offers to confirm again', async () => {
      const services = fakeServices({ confirmed: [MONDAY_OCCURRENCE] });
      await renderCards([MONDAY], { services });
      expect(screen.getByText('Confirmaste tu asistencia.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar asistencia' }));
      await act(async () => {});

      const [call] = services.attendance.cancel.mock.calls;
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject(MONDAY_OCCURRENCE);
      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeInTheDocument();
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

  describe('for a member whose membership is not active', () => {
    it('says so on every card, with the WhatsApp link and no button', async () => {
      await renderCards([MONDAY, TUESDAY], { services: fakeServices({ periods: [] }) });

      expect(screen.getAllByText('Tu membresía no está activa.')).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: 'Escríbenos por WhatsApp' })[0])
        .toHaveAttribute('href', WHATSAPP);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the message alone when there is no WhatsApp link', async () => {
      const { container } = await renderCards([MONDAY], {
        services: fakeServices({ periods: [] }),
        whatsappLink: null,
      });

      expect(screen.getByText('Tu membresía no está activa.')).toBeInTheDocument();
      expect(container.querySelector('a')).toBeNull();
    });
  });

  describe('for a class after the end of the membership', () => {
    it('says the day it runs to, with no button', async () => {
      const services = fakeServices({ periods: [{ startsOn: '2026-10-01', endsOn: '2026-10-24' }] });

      await renderCards([MONDAY], { services });

      expect(screen.getByText('Tu membresía vence el 24 de octubre de 2026.')).toBeInTheDocument();
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
