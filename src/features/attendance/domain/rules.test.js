import { controlState, membershipPrompt } from './rules';
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

// Administrators have free access to classes (migration 20261022120000): the
// same button as a member, without a paid period. Every other rule stays.
describe('controlState for an administrator', () => {
  const asAdmin = (overrides = {}) => controlState({
    occurrence: occurrence(),
    now: NOW,
    membership: { periods: [] },
    confirmedKeys: new Set(),
    isAdmin: true,
    ...overrides,
  });

  it('is confirm with no paid period at all', () => {
    expect(asAdmin()).toBe('confirm');
  });

  it('is confirm when the periods end before the class, where a member is uncovered', () => {
    const periods = [period('2026-09-01', '2026-09-30')];

    expect(asAdmin({ membership: { periods } })).toBe('confirm');
    expect(asAdmin({ membership: { periods }, isAdmin: false })).toBe('uncovered');
  });

  it('is confirm when the only period has not started, where a member is inactive', () => {
    const periods = [period('2026-10-01', '2026-10-31')];

    expect(asAdmin({ membership: { periods } })).toBe('confirm');
    expect(asAdmin({ membership: { periods }, isAdmin: false })).toBe('inactive');
  });

  it('reads a missing flag as not an administrator', () => {
    expect(asAdmin({ isAdmin: undefined })).toBe('inactive');
  });

  it('keeps the 7-day window: a class further ahead is hidden', () => {
    const target = occurrence({
      classDate: '2026-10-08',
      startsAt: new Date(NOW.getTime() + SEVEN_DAYS_MS + 1),
    });

    expect(asAdmin({ occurrence: target })).toBe('hidden');
  });

  it('is confirm at exactly the 7-day boundary, like the database bound', () => {
    const target = occurrence({
      classDate: '2026-10-05',
      startsAt: new Date(NOW.getTime() + SEVEN_DAYS_MS),
    });

    expect(asAdmin({ occurrence: target })).toBe('confirm');
  });

  it('keeps a class that has started closed', () => {
    const target = occurrence({ startsAt: new Date(NOW.getTime()) });

    expect(asAdmin({ occurrence: target })).toBe('started');
  });

  it('is cancel for a class the administrator already confirmed', () => {
    const target = occurrence();

    expect(asAdmin({
      occurrence: target,
      confirmedKeys: new Set([occurrenceKey(target)]),
    })).toBe('cancel');
  });

  it('is hidden while the membership data is not there yet, as for any viewer', () => {
    expect(asAdmin({ membership: null })).toBe('hidden');
  });
});

// What the prompt for a member with no active membership says: who gets it, and which
// of its two forms. Decided here, in Lima time like the card states.
describe('membershipPrompt', () => {
  const prompt = (overrides = {}) => membershipPrompt({
    membership: { periods: [] },
    now: NOW,
    isAdmin: false,
    ...overrides,
  });
  const withPeriods = (...periods) => ({ membership: { periods } });

  it('asks the member to enrol when there is no paid period at all', () => {
    expect(prompt()).toEqual({ kind: 'enrol' });
  });

  it('asks the member to enrol when every period ended before today in Lima', () => {
    expect(prompt(withPeriods(period('2026-08-01', '2026-09-27')))).toEqual({ kind: 'enrol' });
    expect(prompt(withPeriods(
      period('2026-07-01', '2026-07-31'),
      period('2026-08-01', '2026-09-27'),
    ))).toEqual({ kind: 'enrol' });
  });

  it('says when the membership starts when the only period starts later', () => {
    expect(prompt(withPeriods(period('2026-11-03', '2026-12-02'))))
      .toEqual({ kind: 'starts-later', startsOn: '2026-11-03' });
  });

  it('gives the day after today as a start that has not come yet, and today as no prompt', () => {
    expect(prompt(withPeriods(period('2026-09-29', '2026-10-28'))))
      .toEqual({ kind: 'starts-later', startsOn: '2026-09-29' });
    expect(prompt(withPeriods(period('2026-09-28', '2026-10-27')))).toBeNull();
  });

  it('gives the earliest start when several periods start later, whatever their order', () => {
    expect(prompt(withPeriods(
      period('2026-12-10', '2027-01-09'),
      period('2026-11-03', '2026-12-02'),
      period('2027-02-01', '2027-02-28'),
    ))).toEqual({ kind: 'starts-later', startsOn: '2026-11-03' });
  });

  it('ignores the past periods when a later one exists', () => {
    expect(prompt(withPeriods(
      period('2026-07-01', '2026-07-31'),
      period('2026-10-05', '2026-11-04'),
    ))).toEqual({ kind: 'starts-later', startsOn: '2026-10-05' });
  });

  it('gives no prompt when a period covers today, at both ends of it', () => {
    expect(prompt(withPeriods(period('2026-09-01', '2026-10-31')))).toBeNull();
    expect(prompt(withPeriods(period('2026-09-28', '2026-09-28')))).toBeNull();
    expect(prompt(withPeriods(period('2026-09-01', '2026-09-28')))).toBeNull();
  });

  it('gives no prompt when a period covers today, even if another one starts later', () => {
    expect(prompt(withPeriods(
      period('2026-09-01', '2026-09-30'),
      period('2026-11-03', '2026-12-02'),
    ))).toBeNull();
  });

  it('counts today on the Lima calendar, not the UTC one', () => {
    // 2026-09-29T03:00Z is still the evening of the 28th in Lima.
    const lateEvening = new Date('2026-09-29T03:00:00Z');
    const periods = [period('2026-09-28', '2026-09-28'), period('2026-09-29', '2026-10-28')];

    expect(prompt({ now: lateEvening, membership: { periods } })).toBeNull();
    // One day later in Lima the first period is over and the second one covers today.
    expect(prompt({ now: new Date('2026-09-29T06:00:00Z'), membership: { periods } })).toBeNull();
    expect(prompt({
      now: new Date('2026-09-29T03:00:00Z'),
      membership: { periods: [period('2026-09-29', '2026-10-28')] },
    })).toEqual({ kind: 'starts-later', startsOn: '2026-09-29' });
  });

  it('gives no prompt to an administrator, with or without periods', () => {
    expect(prompt({ isAdmin: true })).toBeNull();
    expect(prompt({ isAdmin: true, ...withPeriods(period('2026-11-03', '2026-12-02')) })).toBeNull();
  });

  it('reads only the exact true as an administrator', () => {
    expect(prompt({ isAdmin: 'true' })).toEqual({ kind: 'enrol' });
    expect(prompt({ isAdmin: undefined })).toEqual({ kind: 'enrol' });
  });

  it.each([null, undefined])('gives no prompt without membership data (%s): a visitor, or data not read yet', (membership) => {
    expect(prompt({ membership })).toBeNull();
  });
});
