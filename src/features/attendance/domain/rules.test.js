import { controlState } from './rules';
import { occurrenceKey } from './occurrences';

const NOW = new Date('2026-09-28T12:00:00Z'); // Lima today: 2026-09-28
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

function occurrence(overrides = {}) {
  return {
    classDate: '2026-10-01',
    startTime: '19:00',
    endTime: '19:55',
    genreId: 'salsa',
    roomKey: 'sala-1',
    genreName: 'Salsa',
    roomLabel: 'Sala 1',
    startsAt: new Date(NOW.getTime() + 3 * DAY_MS),
    ...overrides,
  };
}

function period(startsOn, endsOn) {
  return { startsOn, endsOn };
}

describe('controlState', () => {
  it('is confirm for a covered class within the confirmation window', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('confirm');
  });

  it('is hidden for a class more than 7 days away, even when covered', () => {
    const target = occurrence({
      classDate: '2026-10-08',
      startsAt: new Date(NOW.getTime() + 10 * DAY_MS),
    });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('hidden');
  });

  it('is inactive when the member has no active period today', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [] },
      confirmedKeys: new Set(),
    })).toBe('inactive');
  });

  // "Class after paid-until" (Design D4): active today, but the only period
  // ends before this occurrence's own class date.
  it('is uncovered when active today but the class date is after paid-until', () => {
    const target = occurrence({ classDate: '2026-10-01' });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-09-30')] },
      confirmedKeys: new Set(),
    })).toBe('uncovered');
  });

  it('is cancel for a confirmed occurrence that has not started', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('cancel');
  });

  it('is started for a confirmed occurrence that has already started', () => {
    const target = occurrence({ startsAt: new Date(NOW.getTime() - 1) });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('started');
  });

  it('is hidden for a visitor (no membership)', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: null,
      confirmedKeys: new Set(),
    })).toBe('hidden');
  });

  // Precedence edges: these pin down the order the design specifies, not
  // just the six states in isolation.

  it('is cancel for a confirmed occurrence even once the member has gone inactive', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [] },
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('cancel');
  });

  it('is confirm at exactly the 7-day boundary (the DB bound is inclusive)', () => {
    const target = occurrence({
      classDate: '2026-10-05',
      startsAt: new Date(NOW.getTime() + SEVEN_DAYS_MS),
    });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('confirm');
  });

  it('is hidden one millisecond past the 7-day boundary', () => {
    const target = occurrence({
      classDate: '2026-10-05',
      startsAt: new Date(NOW.getTime() + SEVEN_DAYS_MS + 1),
    });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('hidden');
  });

  // A confirmation is always made inside the window, but a client whose
  // clock runs behind the server can still see it more than 7 days away.
  // cancel_own_before_start has no window bound, so the control must stay.
  it('is cancel for a confirmed occurrence beyond the 7-day window', () => {
    const target = occurrence({
      classDate: '2026-10-05',
      startsAt: new Date(NOW.getTime() + SEVEN_DAYS_MS + 1),
    });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('cancel');
  });

  it('is started when startsAt exactly equals now', () => {
    const target = occurrence({ startsAt: new Date(NOW.getTime()) });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-09-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('started');
  });

  it('is inactive for a future prepaid period that covers the class date but not today', () => {
    const target = occurrence({
      classDate: '2026-10-03',
      startsAt: new Date(NOW.getTime() + 5 * DAY_MS),
    });

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: { periods: [period('2026-10-01', '2026-10-31')] },
      confirmedKeys: new Set(),
    })).toBe('inactive');
  });

  it('is hidden for a visitor even when the occurrence key is already in confirmedKeys', () => {
    const target = occurrence();

    expect(controlState({
      occurrence: target,
      now: NOW,
      membership: null,
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('hidden');
  });
});
