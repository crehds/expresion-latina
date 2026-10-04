import { occurrenceOn, nextOccurrence, occurrenceKey } from './occurrences';

/**
 * An enriched session shape (src/data/selectors.js), with the day/slot/room
 * varied per test and everything else fixed to a realistic default.
 */
function buildSession({
  weekday = 1,
  start = '19:00',
  end = '19:55',
  genreId = 'salsa',
  genreName = 'Salsa',
  room = 'Sala 1',
} = {}) {
  return {
    id: `${genreId}-session`,
    dayId: 'day-fixture',
    slotId: 'slot-fixture',
    genreId,
    room,
    day: {
      id: 'day-fixture', name: 'Day', shortName: 'Day', weekday,
    },
    slot: { id: 'slot-fixture', start, end },
    genre: { id: genreId, name: genreName },
    teacher: null,
    level: null,
    note: null,
  };
}

describe('occurrenceOn', () => {
  it('builds the full shape for a realistic enriched session', () => {
    const session = buildSession({ weekday: 1, start: '19:00', end: '19:55' }); // Monday

    expect(occurrenceOn(session, '2026-09-28')).toEqual({
      classDate: '2026-09-28',
      startTime: '19:00',
      endTime: '19:55',
      genreId: 'salsa',
      roomKey: 'sala-1',
      genreName: 'Salsa',
      roomLabel: 'Sala 1',
      startsAt: new Date('2026-09-29T00:00:00.000Z'),
    });
  });

  // Same outputs as `toSlug` (scripts/data/build-academy.mjs): an accented
  // room name must slug the same way the data pipeline would.
  it.each([
    ['Sala 1', 'sala-1'],
    ['Salón Principal', 'salon-principal'],
  ])('slugs room %s to roomKey %s', (room, roomKey) => {
    const session = buildSession({ weekday: 1, room });

    expect(occurrenceOn(session, '2026-09-28').roomKey).toBe(roomKey);
  });

  it('rejects a date that does not fall on the session weekday', () => {
    const session = buildSession({ weekday: 1 }); // Monday

    expect(() => occurrenceOn(session, '2026-09-29')).toThrow(); // Tuesday
  });

  it.each([
    ['punctuation-only room', '!!!'],
    ['whitespace-only room', '   '],
  ])('rejects an unsluggable room (%s)', (_label, room) => {
    const session = buildSession({ weekday: 1, room });

    expect(() => occurrenceOn(session, '2026-09-28')).toThrow();
  });

  it('rejects a room whose slug is longer than 60 characters', () => {
    const session = buildSession({ weekday: 1, room: 'x'.repeat(61) });

    expect(() => occurrenceOn(session, '2026-09-28')).toThrow();
  });
});

describe('nextOccurrence', () => {
  it("returns today's occurrence before today's class has started", () => {
    const session = buildSession({ weekday: 1, start: '19:00', end: '19:55' }); // Monday
    const now = new Date('2026-09-28T12:00:00Z'); // Lima 2026-09-28, before the 19:00 start

    expect(nextOccurrence(session, now).classDate).toBe('2026-09-28');
  });

  it("returns next week once today's class has started", () => {
    const session = buildSession({ weekday: 1, start: '19:00', end: '19:55' });
    const now = new Date('2026-09-29T01:00:00Z'); // Lima 2026-09-28, after the 00:00Z start

    expect(nextOccurrence(session, now).classDate).toBe('2026-10-05');
  });

  it('returns next week when now is exactly the start instant', () => {
    const session = buildSession({ weekday: 1, start: '19:00', end: '19:55' });
    const now = new Date('2026-09-29T00:00:00.000Z'); // exactly limaInstant('2026-09-28', '19:00')

    expect(nextOccurrence(session, now).classDate).toBe('2026-10-05');
  });

  it('returns the next matching weekday for a session on another day', () => {
    const session = buildSession({ weekday: 3, start: '19:00', end: '19:55' }); // Wednesday
    const now = new Date('2026-09-28T12:00:00Z'); // Lima Monday 2026-09-28

    expect(nextOccurrence(session, now).classDate).toBe('2026-09-30');
  });

  it('wraps into next week for a session whose weekday comes earlier in the week', () => {
    const session = buildSession({ weekday: 0, start: '19:00', end: '19:55' }); // Sunday
    const now = new Date('2026-09-28T12:00:00Z'); // Lima Monday 2026-09-28

    expect(nextOccurrence(session, now).classDate).toBe('2026-10-04');
  });

  // The Lima day rolls over at 05:00Z, not at UTC midnight. At this instant
  // the UTC calendar date is already 2026-09-29 (Tuesday), but the Lima wall
  // clock still reads 2026-09-28 (Monday) 23:30 -- a naive
  // `now.toISOString().slice(0, 10)` "today" would see a Tuesday, not find a
  // match for a Monday session this week, and skip a whole week ahead.
  it('uses the Lima calendar date, not the UTC one, right after UTC midnight', () => {
    const session = buildSession({ weekday: 1, start: '23:45', end: '00:40' }); // Monday, late night
    const now = new Date('2026-09-29T04:30:00Z');

    expect(nextOccurrence(session, now).classDate).toBe('2026-09-28');
  });
});

describe('occurrenceKey', () => {
  it('joins classDate, startTime, genreId and roomKey with |', () => {
    const occurrence = occurrenceOn(buildSession({ weekday: 1 }), '2026-09-28');

    expect(occurrenceKey(occurrence)).toBe('2026-09-28|19:00|salsa|sala-1');
  });
});
