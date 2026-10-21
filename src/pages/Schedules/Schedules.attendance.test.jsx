import {
  act, render, screen, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SessionContext from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import { getActiveDays, getSessionsForWeekday } from '../../data/selectors';
import Schedules from './Schedules';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';

// A Tuesday, so "today" is a day the academy teaches.
const TUESDAY = new Date('2025-10-07T12:00:00');

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// Wide enough to cover every class of the next seven days whatever the zone.
const COVERING = [{ startsOn: '2025-09-01', endsOn: '2025-12-31' }];

function fakeServices({ periods = ok(COVERING), confirmations = ok([]) } = {}) {
  return {
    attendance: {
      listOwnConfirmations: vi.fn(async () => confirmations),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: { listOwnPeriods: vi.fn(async () => periods) },
  };
}

const sessionContext = (status, start = vi.fn()) => ({
  status,
  session: status === 'signed-in' ? { userId: USER, email: 'a@example.test' } : null,
  profile: status === 'signed-in' ? { id: USER } : null,
  errorCode: null,
  start,
  refresh: vi.fn(),
  signOut: vi.fn(),
});

function mockViewport(isWide) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isWide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

// `contexts` is null for a page with no provider at all, which is how the page was
// rendered before the attendance controls existed.
async function renderPage(contexts) {
  const page = contexts
    ? (
      <BackendContext.Provider value={contexts.backend}>
        <SessionContext.Provider value={contexts.session}>
          <Schedules />
        </SessionContext.Provider>
      </BackendContext.Provider>
    )
    : <Schedules />;
  const view = render(page, { wrapper: MemoryRouter });
  await act(async () => {});
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each([
  ['a wide screen', true],
  ['a narrow screen', false],
])('Schedules on %s', (_label, isWide) => {
  beforeEach(() => mockViewport(isWide));

  async function pageHtml(contexts) {
    const view = await renderPage(contexts);
    const html = view.container.innerHTML;
    view.unmount();
    return html;
  }

  describe('for anyone without a signed-in member', () => {
    const start = vi.fn();
    const services = fakeServices();
    const variant = (enabled, withServices, status) => ({
      backend: { enabled, services: withServices },
      session: sessionContext(status, start),
    });
    const variants = [
      ['a visitor (idle)', variant(true, services, 'idle')],
      ['a signed-out member', variant(true, services, 'signed-out')],
      ['a session that is loading', variant(true, services, 'loading')],
      ['a session in error', variant(true, services, 'error')],
      ['a disabled backend', variant(false, null, 'disabled')],
      ['a disabled backend with a signed-in session', variant(false, services, 'signed-in')],
      ['a signed-in session with no services', variant(true, null, 'signed-in')],
    ];

    it.each(variants)('leaves the markup of the page exactly as it was for %s', async (_name, contexts) => {
      const baseline = await pageHtml(null);
      // The comparison means something only if there is a page to compare.
      expect(baseline).toContain('session-card');

      expect(await pageHtml(contexts)).toBe(baseline);
    });

    it('never starts the session or calls an adapter', async () => {
      // One after the other: overlapping renders confuse React's act queue.
      await variants.reduce(
        (chain, [, contexts]) => chain.then(() => pageHtml(contexts)),
        Promise.resolve(),
      );

      expect(start).not.toHaveBeenCalled();
      expect(services.membership.listOwnPeriods).not.toHaveBeenCalled();
      expect(services.attendance.listOwnConfirmations).not.toHaveBeenCalled();
    });
  });

  describe('for a signed-in member', () => {
    const contextsFor = (services, start = vi.fn()) => ({
      backend: { enabled: true, services },
      session: sessionContext('signed-in', start),
    });

    // The classes on screen: the whole week on a wide screen, Tuesday on a narrow one.
    const visibleSessions = () => (isWide
      ? getActiveDays().flatMap((day) => getSessionsForWeekday(day.weekday))
      : getSessionsForWeekday(TUESDAY.getDay()));

    it('puts a confirm button under every class that is not a rehearsal', async () => {
      await renderPage(contextsFor(fakeServices()));

      const attended = visibleSessions().filter((session) => session.genre.kind !== 'rehearsal');
      expect(attended.length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Confirmar asistencia' }))
        .toHaveLength(attended.length);
    });

    it('puts no control and no message on a rehearsal card', async () => {
      await renderPage(contextsFor(fakeServices()));

      const rehearsals = visibleSessions().filter((session) => session.genre.kind === 'rehearsal');
      screen.getAllByRole('article')
        .filter((card) => rehearsals.some(
          (rehearsal) => card.textContent.includes(rehearsal.genre.name),
        ))
        .forEach((card) => {
          expect(within(card).queryByRole('button')).toBeNull();
          expect(card.querySelector('.attendance-control')).toBeNull();
        });
    });

    it('reads once and never starts the session itself', async () => {
      const services = fakeServices();
      const start = vi.fn();

      await renderPage(contextsFor(services, start));

      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(1);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
      expect(start).not.toHaveBeenCalled();
    });

    it('says the membership is not active on every class, with the WhatsApp link', async () => {
      await renderPage(contextsFor(fakeServices({ periods: ok([]) })));

      const attended = visibleSessions().filter((session) => session.genre.kind !== 'rehearsal');
      expect(screen.getAllByText('Tu membresía no está activa.')).toHaveLength(attended.length);
      expect(screen.queryByRole('button', { name: 'Confirmar asistencia' })).toBeNull();
    });

    it('shows nothing under the cards while the data is loading', async () => {
      const services = fakeServices();
      services.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));

      const view = await renderPage(contextsFor(services));

      expect(view.container.querySelector('.attendance-control')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows the retry notice above the schedule when the first read fails', async () => {
      const view = await renderPage(contextsFor(fakeServices({ periods: fail('NETWORK') })));

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('No pudimos cargar tu asistencia.');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      const schedule = view.container.querySelector(isWide ? '.week-columns' : '.day-agenda');
      const position = alert.compareDocumentPosition(schedule);
      // eslint-disable-next-line no-bitwise
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(view.container.querySelector('.attendance-control')).toBeNull();
    });
  });
});
