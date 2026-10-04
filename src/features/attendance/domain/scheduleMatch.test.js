import { expectedOccurrenceKeys, flagScheduleMismatch } from './scheduleMatch';

function buildSession({
  weekday = 1,
  start = '19:00',
  end = '19:55',
  genreId = 'salsa',
  genreName = 'Salsa',
  room = 'Sala 1',
  teacherId = 'ana',
} = {}) {
  return {
    id: `${genreId}-${weekday}-${start}`,
    room,
    day: { id: `day-${weekday}`, weekday },
    slot: { id: `slot-${start}`, start, end },
    genre: { id: genreId, name: genreName },
    teacher: { id: teacherId },
  };
}

/** A stand-in for the `getSessionsForWeekday` selector over a fixed list. */
function selectorOver(sessions) {
  return (weekday) => sessions.filter((session) => session.day.weekday === weekday);
}

const SCHEDULE = [
  buildSession({ weekday: 1, start: '19:00' }),
  buildSession({
    weekday: 1, start: '20:00', genreId: 'bachata', genreName: 'Bachata', room: 'Sala 2',
  }),
  buildSession({ weekday: 5, start: '19:00' }),
  buildSession({
    weekday: 6, start: '10:00', genreId: 'bachata', genreName: 'Bachata', room: 'Sala 2',
  }),
];

function confirmationFor(overrides = {}) {
  return {
    id: 'c1',
    memberId: 'm1',
    classDate: '2026-09-28', // Monday
    startTime: '19:00',
    genreId: 'salsa',
    roomKey: 'sala-1',
    ...overrides,
  };
}

describe('expectedOccurrenceKeys', () => {
  it('covers a range across a week boundary, skipping weekdays without sessions', () => {
    // Fri 2026-10-02 .. Tue 2026-10-06: Fri, Sat, Sun (none), Mon (two), Tue (none).
    const keys = expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-10-02', '2026-10-06');

    expect(keys).toEqual(new Set([
      '2026-10-02|19:00|salsa|sala-1',
      '2026-10-03|10:00|bachata|sala-2',
      '2026-10-05|19:00|salsa|sala-1',
      '2026-10-05|20:00|bachata|sala-2',
    ]));
  });

  it('includes both ends of the range', () => {
    const keys = expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-09-28', '2026-10-02');

    expect(keys.has('2026-09-28|19:00|salsa|sala-1')).toBe(true);
    expect(keys.has('2026-10-02|19:00|salsa|sala-1')).toBe(true);
  });

  it('handles a single-day range', () => {
    const keys = expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-09-28', '2026-09-28');

    expect(keys).toEqual(new Set([
      '2026-09-28|19:00|salsa|sala-1',
      '2026-09-28|20:00|bachata|sala-2',
    ]));
  });

  it('is empty for a range of weekdays that hold no sessions', () => {
    // Tue 2026-09-29 and Wed 2026-09-30 have no sessions.
    expect(expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-09-29', '2026-09-30').size).toBe(0);
  });

  it('is empty when the schedule is empty', () => {
    expect(expectedOccurrenceKeys(selectorOver([]), '2026-09-28', '2026-10-04').size).toBe(0);
  });

  it('asks the selector for each date weekday (0 = Sunday)', () => {
    const asked = [];
    expectedOccurrenceKeys((weekday) => { asked.push(weekday); return []; }, '2026-10-03', '2026-10-05');

    expect(asked).toEqual([6, 0, 1]);
  });

  it('throws for a malformed or impossible date', () => {
    const select = selectorOver(SCHEDULE);

    expect(() => expectedOccurrenceKeys(select, '28/09/2026', '2026-10-02')).toThrow();
    expect(() => expectedOccurrenceKeys(select, '2026-09-28', '2026-02-30')).toThrow();
    expect(() => expectedOccurrenceKeys(select, undefined, '2026-10-02')).toThrow();
  });

  it('throws for an inverted range', () => {
    expect(() => expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-10-02', '2026-09-28')).toThrow();
  });

  it('throws when the selector is not a function', () => {
    expect(() => expectedOccurrenceKeys(null, '2026-09-28', '2026-09-29')).toThrow();
  });
});

describe('flagScheduleMismatch', () => {
  const expected = () => expectedOccurrenceKeys(selectorOver(SCHEDULE), '2026-09-28', '2026-10-04');

  it('keeps a confirmation whose occurrence still exists', () => {
    const confirmation = confirmationFor();

    const result = flagScheduleMismatch([confirmation], expected());

    expect(result.mismatched).toEqual([]);
    expect([...result.byOccurrence.keys()]).toEqual(['2026-09-28|19:00|salsa|sala-1']);
    expect(result.byOccurrence.get('2026-09-28|19:00|salsa|sala-1')).toEqual([confirmation]);
  });

  it('groups several confirmations of one occurrence together', () => {
    const first = confirmationFor({ id: 'c1', memberId: 'm1' });
    const second = confirmationFor({ id: 'c2', memberId: 'm2' });

    const result = flagScheduleMismatch([first, second], expected());

    expect(result.byOccurrence.get('2026-09-28|19:00|salsa|sala-1')).toEqual([first, second]);
  });

  it('flags a class moved from 19:00 to 20:00', () => {
    const moved = flagScheduleMismatch(
      [confirmationFor()],
      expectedOccurrenceKeys(
        selectorOver([buildSession({ weekday: 1, start: '20:00' })]),
        '2026-09-28',
        '2026-10-04',
      ),
    );

    expect(moved.mismatched).toEqual([confirmationFor()]);
    expect(moved.byOccurrence.size).toBe(0);
  });

  it('keeps a confirmation when only the teacher, end time or genre name change', () => {
    const edited = selectorOver([buildSession({
      weekday: 1, start: '19:00', end: '20:30', teacherId: 'luis', genreName: 'Salsa On2',
    })]);

    const result = flagScheduleMismatch(
      [confirmationFor()],
      expectedOccurrenceKeys(edited, '2026-09-28', '2026-10-04'),
    );

    expect(result.mismatched).toEqual([]);
    expect(result.byOccurrence.size).toBe(1);
  });

  it.each([
    ['start time', { startTime: '18:00' }],
    ['room', { roomKey: 'sala-3' }],
    ['genre', { genreId: 'bachata' }],
    ['date (the weekday no longer holds the class)', { classDate: '2026-09-29' }],
    ['date (beyond the expected range)', { classDate: '2026-10-05' }],
  ])('flags a confirmation whose %s no longer exists', (_label, overrides) => {
    const confirmation = confirmationFor(overrides);

    const result = flagScheduleMismatch([confirmation], expected());

    expect(result.mismatched).toEqual([confirmation]);
    expect(result.byOccurrence.size).toBe(0);
  });

  it('splits a mixed list and keeps the input order in both parts', () => {
    const kept = confirmationFor({ id: 'kept' });
    const orphan = confirmationFor({ id: 'orphan', startTime: '18:00' });
    const keptToo = confirmationFor({ id: 'kept-too', classDate: '2026-10-02' });

    const result = flagScheduleMismatch([orphan, kept, keptToo], expected());

    expect(result.mismatched).toEqual([orphan]);
    expect([...result.byOccurrence.keys()]).toEqual([
      '2026-09-28|19:00|salsa|sala-1',
      '2026-10-02|19:00|salsa|sala-1',
    ]);
  });

  it('returns empty parts for no confirmations', () => {
    const result = flagScheduleMismatch([], expected());

    expect(result.mismatched).toEqual([]);
    expect(result.byOccurrence.size).toBe(0);
  });

  it('flags everything when nothing is expected', () => {
    const confirmation = confirmationFor();

    expect(flagScheduleMismatch([confirmation], new Set()).mismatched).toEqual([confirmation]);
  });

  it.each([
    ['a Postgres-shaped start time', { startTime: '19:00:00' }],
    ['an out-of-range start time', { startTime: '24:00' }],
    ['a malformed class date', { classDate: '28/09/2026' }],
    ['an impossible class date', { classDate: '2026-02-30' }],
  ])('throws for a confirmation with %s instead of reporting it as mismatched', (_label, overrides) => {
    expect(() => flagScheduleMismatch([confirmationFor(overrides)], expected())).toThrow();
  });

  it('names the invalid field and never echoes a confirmation value in the error', () => {
    const secret = confirmationFor({
      memberId: 'member-secret-77', memberName: 'Secret Person', startTime: '19:00:00',
    });
    const missing = { memberId: 'member-secret-77', memberName: 'Secret Person' };

    const messages = [secret, missing, confirmationFor({ classDate: 'not-a-date-secret' })].map((bad) => {
      try {
        flagScheduleMismatch([bad], expected());
      } catch (error) {
        return error.message;
      }
      return '';
    });

    messages.forEach((message) => {
      expect(message).not.toBe('');
      expect(message).not.toContain('secret');
      expect(message).not.toContain('Secret');
      expect(message).not.toContain('19:00:00');
    });
    expect(messages[0]).toContain('startTime');
    expect(messages[1]).toContain('classDate');
    expect(messages[2]).toContain('classDate');
  });

  it('throws for malformed input', () => {
    expect(() => flagScheduleMismatch(null, expected())).toThrow();
    expect(() => flagScheduleMismatch([confirmationFor()], ['2026-09-28|19:00|salsa|sala-1'])).toThrow();
    expect(() => flagScheduleMismatch([confirmationFor()], undefined)).toThrow();
    expect(() => flagScheduleMismatch([{ classDate: '2026-09-28' }], expected())).toThrow();
    expect(() => flagScheduleMismatch([null], expected())).toThrow();
  });
});
