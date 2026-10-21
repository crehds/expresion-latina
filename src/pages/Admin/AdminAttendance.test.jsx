import {
  fireEvent, render, screen, within,
} from '@testing-library/react';

import { getSessionsForWeekday } from '../../data/selectors';
import { occurrenceOn } from '../../features/attendance/domain/occurrences';
import BackendContext from '../../shared/backend/BackendContext';
import AdminAttendance from './AdminAttendance';

// Wednesday 2026-10-21, noon in Lima (UTC-05:00): the window is 21 to 28 October.
const NOW = new Date('2026-10-21T17:00:00Z');
const MONDAY = '2026-10-26';

// A class of the real schedule on that Monday, so the page's own comparison with the
// schedule finds it; the rows are built from it the way the adapter returns them.
const [SESSION] = getSessionsForWeekday(1);
const OCCURRENCE = occurrenceOn(SESSION, MONDAY);

const row = (fullName, overrides = {}) => ({
  memberId: `id-${fullName}`,
  fullName,
  classDate: OCCURRENCE.classDate,
  startTime: OCCURRENCE.startTime,
  endTime: OCCURRENCE.endTime,
  genreId: OCCURRENCE.genreId,
  roomKey: OCCURRENCE.roomKey,
  genreName: OCCURRENCE.genreName,
  roomLabel: OCCURRENCE.roomLabel,
  ...overrides,
});

// A confirmation for a class that is not in the schedule at any hour.
const offSchedule = (fullName, overrides = {}) => row(fullName, {
  classDate: '2026-10-23', startTime: '23:30', endTime: '00:30', ...overrides,
});

function renderPage(
  listUpcomingConfirmations,
  { attendance = { listUpcomingConfirmations } } = {},
) {
  return render(
    <BackendContext.Provider value={{ enabled: true, services: { attendance } }}>
      <AdminAttendance />
    </BackendContext.Provider>,
  );
}

const answer = (data) => vi.fn(async () => ({ ok: true, data }));

describe('AdminAttendance', () => {
  beforeEach(() => {
    // Only the clock: faking timers as well would hang the async queries.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a section with a level 2 heading, the frame bringing the level 1', async () => {
    renderPage(answer([row('Ana Perez')]));

    const section = screen.getByRole('region', { name: 'Asistencia' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Asistencia' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    await screen.findByText('Ana Perez');
  });

  it('reads the week from today in Lima to seven days on, once', async () => {
    const list = answer([]);

    renderPage(list);

    await screen.findByText('Nadie ha confirmado todavía.');
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ fromDate: '2026-10-21', toDate: '2026-10-28' });
  });

  it('says it is loading until the answer comes', () => {
    renderPage(vi.fn(() => new Promise(() => {})));

    expect(screen.getByRole('status')).toHaveTextContent('Cargando las confirmaciones…');
    expect(screen.queryByText('Nadie ha confirmado todavía.')).not.toBeInTheDocument();
  });

  it('lists the names under the class they confirmed, from the stored snapshot, with the count', async () => {
    renderPage(answer([row('Luis Soto'), row('Ana Perez')]));

    expect(await screen.findByRole('heading', { level: 3, name: OCCURRENCE.genreName }))
      .toBeInTheDocument();
    const names = screen.getByRole('list', { name: OCCURRENCE.genreName });
    expect(within(names).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Ana Perez', 'Luis Soto']);
    expect(screen.getByText('2 personas')).toBeInTheDocument();
    expect(screen.queryByText('Ya no coincide con el horario')).not.toBeInTheDocument();
  });

  it('shows no class when nobody confirmed, and says so', async () => {
    renderPage(answer([]));

    expect(await screen.findByText('Nadie ha confirmado todavía.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('puts a confirmation that left the schedule under the fixed title, apart from the classes', async () => {
    renderPage(answer([row('Ana Perez'), offSchedule('Beto Ruiz')]));

    const mismatch = await screen.findByRole('region', { name: 'Ya no coincide con el horario' });
    expect(within(mismatch).getByText('Beto Ruiz')).toBeInTheDocument();
    expect(within(mismatch).getByText('23 de octubre de 2026 · 23:30 a 00:30 · Sala 1'))
      .toBeInTheDocument();
    expect(within(mismatch).queryByText('Ana Perez')).not.toBeInTheDocument();
    const names = screen.getByRole('list', { name: OCCURRENCE.genreName });
    expect(within(names).queryByText('Beto Ruiz')).not.toBeInTheDocument();
  });

  it('shows the mismatch section even when every confirmation left the schedule', async () => {
    renderPage(answer([offSchedule('Beto Ruiz')]));

    expect(await screen.findByRole('region', { name: 'Ya no coincide con el horario' }))
      .toBeInTheDocument();
    expect(screen.queryByText('Nadie ha confirmado todavía.')).not.toBeInTheDocument();
  });

  it('shows nothing of a member but the name', async () => {
    renderPage(answer([{ ...row('Ana Perez'), email: 'ana@example.test', status: 'active' }]));

    await screen.findByText('Ana Perez');
    expect(screen.queryByText(/ana@example\.test|active|id-Ana/)).not.toBeInTheDocument();
  });

  describe('when the read fails', () => {
    const failing = () => vi.fn(async () => ({ ok: false, code: 'NETWORK' }));

    it('shows a fixed alert, with nothing of the code, and a way to try again', async () => {
      renderPage(failing());

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos cargar las confirmaciones de asistencia.');
      expect(screen.queryByText(/NETWORK/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.queryByText('Nadie ha confirmado todavía.')).not.toBeInTheDocument();
    });

    it('reads again on retry and then shows the list', async () => {
      const list = vi.fn()
        .mockResolvedValueOnce({ ok: false, code: 'UNKNOWN' })
        .mockResolvedValueOnce({ ok: true, data: [row('Ana Perez')] });
      renderPage(list);
      fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Ana Perez')).toBeInTheDocument();
      expect(list).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('fails the same way when the adapter rejects', async () => {
      renderPage(vi.fn(async () => { throw new Error('boom'); }));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos cargar las confirmaciones de asistencia.');
    });
  });

  // flagScheduleMismatch fails for the whole list on one malformed row, on purpose.
  // The page must still show who confirmed, and say it could not compare.
  describe('when the confirmations cannot be compared with the schedule (P3)', () => {
    it.each([
      ['a start time with seconds', { startTime: '19:00:30' }],
      ['a date that is no calendar day', { classDate: '2026-02-30' }],
    ])('shows an alert and the best-effort list, with no mismatch section, for %s', async (_label, bad) => {
      renderPage(answer([row('Ana Perez'), row('Beto Ruiz', bad)]));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos comparar las confirmaciones con el horario actual.');
      expect(screen.getByText('Ana Perez')).toBeInTheDocument();
      expect(screen.getByText('Beto Ruiz')).toBeInTheDocument();
      expect(screen.queryByText('Ya no coincide con el horario')).not.toBeInTheDocument();
      expect(screen.queryByText('Nadie ha confirmado todavía.')).not.toBeInTheDocument();
    });

    it('groups the best-effort list by class', async () => {
      renderPage(answer([
        row('Ana Perez'),
        row('Beto Ruiz', { startTime: '19:00:30' }),
        row('Carla Soto'),
      ]));

      await screen.findByRole('alert');
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
      expect(screen.getByText('2 personas')).toBeInTheDocument();
      expect(screen.getByText('1 persona')).toBeInTheDocument();
    });

    it('does not echo the bad value', async () => {
      renderPage(answer([row('Beto Ruiz', { classDate: 'internal-detail-7' })]));

      await screen.findByRole('alert');
      expect(screen.queryByText(/internal-detail-7/)).not.toBeInTheDocument();
    });

    it('does not raise the alert for a list that compares fine', async () => {
      renderPage(answer([row('Ana Perez')]));

      await screen.findByText('Ana Perez');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('renders nothing, asking for nothing, without an attendance adapter', () => {
    const { container } = renderPage(vi.fn(), { attendance: null });

    expect(container).toBeEmptyDOMElement();
  });
});
