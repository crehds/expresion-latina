import { formatDateOnly } from './dateOnly';

// The zone the machine starts with, by name. Deleting TZ is not enough to get it
// back: on Windows the last zone that was set stays in force.
const HOST_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function restoreTimeZone() {
  process.env.TZ = HOST_TIME_ZONE;
}

// Whether the runtime honours a mid-process TZ change is a property of the
// environment, not of the formatter. Without this check the cases that switch
// the zone would pass on a runtime that ignored the switch, for the wrong reason.
function honoursTimeZoneChanges() {
  const dayIn = (timeZone) => {
    process.env.TZ = timeZone;
    return new Date('2026-10-19').getDate();
  };
  try {
    return dayIn('America/Lima') !== dayIn('Pacific/Kiritimati');
  } finally {
    restoreTimeZone();
  }
}

describe('formatDateOnly', () => {
  it.each([
    ['2026-10-19', '19 de octubre de 2026'],
    ['2026-01-05', '5 de enero de 2026'],
    ['2026-03-01', '1 de marzo de 2026'],
    ['2026-12-31', '31 de diciembre de 2026'],
    ['2028-02-29', '29 de febrero de 2028'],
  ])('writes %s in Spanish as "%s"', (isoDate, expected) => {
    expect(formatDateOnly(isoDate)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['words', 'not-a-date'],
    ['an impossible date', '2026-02-30'],
    ['an instant', '2026-10-19T00:00:00Z'],
    ['a single-digit month and day', '2026-1-5'],
    ['undefined', undefined],
    ['null', null],
    ['a number', 20261019],
    ['a Date', new Date('2026-10-19T12:00:00Z')],
  ])('rejects what is not an ISO date: %s', (_label, value) => {
    expect(() => formatDateOnly(value)).toThrow(/ISO date/);
  });

  // A date-only value is a calendar day, not an instant. `new Date('2026-10-19')`
  // is midnight UTC, which is still the 18th in Lima (UTC-05:00); a date built
  // from the local components and written in UTC slips the other way east of
  // Greenwich. These cases run on both sides of Greenwich, so neither slip can
  // pass.
  describe.skipIf(!honoursTimeZoneChanges())('whatever time zone the machine is set to', () => {
    afterEach(restoreTimeZone);

    it.each(['America/Lima', 'Pacific/Kiritimati', 'UTC'])('keeps the day in %s', (timeZone) => {
      process.env.TZ = timeZone;

      expect(formatDateOnly('2026-10-19')).toBe('19 de octubre de 2026');
      expect(formatDateOnly('2026-01-01')).toBe('1 de enero de 2026');
      expect(formatDateOnly('2026-12-31')).toBe('31 de diciembre de 2026');
      expect(formatDateOnly('2028-02-29')).toBe('29 de febrero de 2028');
    });
  });
});
