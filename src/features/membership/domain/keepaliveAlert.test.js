import {
  DEFAULT_ALERT_DAYS, keepaliveStatus, parseAlertDays, resolveAlertDays,
} from './keepaliveAlert';

describe('parseAlertDays', () => {
  it('has a default of three days', () => {
    expect(DEFAULT_ALERT_DAYS).toBe(3);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])('gives the default threshold when the variable is %s', (_label, value) => {
    expect(parseAlertDays(value)).toEqual({ kind: 'days', days: 3 });
  });

  it.each(['off', 'OFF', 'Off', 'oFF'])('turns the banner off for %j, whatever its case', (value) => {
    expect(parseAlertDays(value)).toEqual({ kind: 'off' });
  });

  it.each([
    ['1', 1],
    ['3', 3],
    ['7', 7],
    ['14', 14],
    ['30', 30],
    ['365', 365],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('takes %j as a threshold of %i days', (value, days) => {
    expect(parseAlertDays(value)).toEqual({ kind: 'days', days });
  });

  it.each([
    // Not a number of days at all.
    'abc', 'offf', 'of', 'o ff', 'on', 'true', 'false', 'null', 'undefined', 'none', '3d', '3 days', '0off',
    // Not a whole number of at least one.
    '0', '00', '-0', '-1', '3.5', '3.', '.5', '0.0', 'Infinity', 'NaN',
    // Not written in digits only.
    '+3', '1e2', '1E2', '0x10', '1_000', '1,000', '٣', '３',
    // A leading zero, or anything around the value.
    '03', '007', ' 3', '3 ', '\t3', '3\n', ' off', 'off ', 'off\n', '   ', ' ', '\n',
    // Beyond what a number holds exactly (the last safe integer is accepted above).
    '9007199254740992', '9007199254740993', '99999999999999999999',
  ])('refuses %j as malformed', (value) => {
    expect(parseAlertDays(value)).toEqual({ kind: 'malformed' });
  });

  it('refuses a digit string so long that it is no number as malformed', () => {
    expect(parseAlertDays('9'.repeat(400))).toEqual({ kind: 'malformed' });
  });

  // The variable is text or missing; anything else is never read as a number or
  // as text, and refusing it must not throw, so the build can word the failure.
  it.each([
    ['null', null],
    ['the number 3', 3],
    ['the number 0', 0],
    ['NaN', Number.NaN],
    ['true', true],
    ['an object', {}],
    ['a list with the text 3', ['3']],
    ['a function', () => 3],
  ])('refuses %s as malformed, without throwing', (_label, value) => {
    expect(parseAlertDays(value)).toEqual({ kind: 'malformed' });
  });
});

describe('resolveAlertDays', () => {
  it.each([
    ['unset', undefined, 3],
    ['empty', '', 3],
    ['the default written out', '3', 3],
    ['a week', '7', 7],
    ['a year', '365', 365],
  ])('gives the days the banner waits when the variable is %s', (_label, value, days) => {
    expect(resolveAlertDays(value)).toBe(days);
  });

  it.each(['off', 'OFF', 'Off'])('gives null, which is no banner at all, for %j', (value) => {
    expect(resolveAlertDays(value)).toBeNull();
  });

  // The build refuses these, so only the dev server and the tests can meet them,
  // and there a typo must not silence the banner or break the page.
  it.each([
    ['text', 'abc'],
    ['zero', '0'],
    ['negative', '-1'],
    ['fractional', '3.5'],
    ['padded', ' 3'],
    ['with a leading zero', '03'],
    ['a misspelt off', 'offf'],
    ['beyond what a number holds exactly', '9007199254740992'],
    ['null', null],
    ['a number', 7],
  ])('counts the malformed value %s as the default', (_label, value) => {
    expect(resolveAlertDays(value)).toBe(DEFAULT_ALERT_DAYS);
  });
});

describe('keepaliveStatus', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  // 10:00 on 20 October 2026 in Lima.
  const NOW = new Date('2026-10-20T15:00:00Z');

  const instantAgo = (ms) => new Date(NOW.getTime() - ms).toISOString();
  const check = (lastPingAt, days = 3) => keepaliveStatus({ lastPingAt, now: NOW, days });

  it('is unknown when no ping is recorded, so that there is nothing to say', () => {
    expect(check(null)).toEqual({ status: 'unknown' });
  });

  it('is fresh for a ping that has just happened', () => {
    expect(check(instantAgo(0))).toEqual({ status: 'fresh' });
    expect(check(instantAgo(HOUR))).toEqual({ status: 'fresh' });
  });

  it('is fresh exactly at the threshold, and stale one millisecond after', () => {
    expect(check(instantAgo(3 * DAY))).toEqual({ status: 'fresh' });
    expect(check(instantAgo(3 * DAY + 1))).toEqual({
      status: 'stale',
      lastPingAt: new Date(NOW.getTime() - 3 * DAY - 1),
      daysAgo: 3,
    });
  });

  it('counts the whole days that have passed, rounding down', () => {
    expect(check(instantAgo(4 * DAY - 1)).daysAgo).toBe(3);
    expect(check(instantAgo(4 * DAY)).daysAgo).toBe(4);
    expect(check(instantAgo(4 * DAY + 1)).daysAgo).toBe(4);
    expect(check(instantAgo(10 * DAY + 23 * HOUR)).daysAgo).toBe(10);
  });

  it('gives the instant of the ping as a date, whatever offset the database wrote it with', () => {
    // How the database writes it: microseconds and an offset.
    expect(check('2026-10-10T12:00:00.123456+00:00')).toEqual({
      status: 'stale',
      lastPingAt: new Date('2026-10-10T12:00:00.123Z'),
      daysAgo: 10,
    });
    // The same instant written on the Lima clock.
    expect(check('2026-10-10T07:00:00-05:00').lastPingAt)
      .toEqual(new Date('2026-10-10T12:00:00.000Z'));
  });

  it('reads the threshold it is given', () => {
    expect(check(instantAgo(5 * DAY), 7)).toEqual({ status: 'fresh' });
    expect(check(instantAgo(7 * DAY), 7)).toEqual({ status: 'fresh' });
    expect(check(instantAgo(8 * DAY), 7)).toMatchObject({ status: 'stale', daysAgo: 8 });
    expect(check(instantAgo(2 * DAY), 1)).toMatchObject({ status: 'stale', daysAgo: 2 });
    expect(check(instantAgo(DAY), 1)).toEqual({ status: 'fresh' });
  });

  it('is fresh for a ping in the future, which only a clock that is behind can explain', () => {
    expect(check(new Date(NOW.getTime() + 1).toISOString())).toEqual({ status: 'fresh' });
    expect(check(new Date(NOW.getTime() + 30 * DAY).toISOString())).toEqual({ status: 'fresh' });
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['a word', 'yesterday'],
    ['text with no date in it', 'not a date'],
    ['a month that does not exist', '2026-13-01T00:00:00Z'],
    ['an hour that does not exist', '2026-10-16T25:00:00Z'],
  ])('is unknown for an instant that is %s', (_label, value) => {
    expect(check(value)).toEqual({ status: 'unknown' });
  });

  it.each([
    ['missing', undefined],
    ['a number', 1760000000000],
    ['a date', new Date('2026-10-10T12:00:00Z')],
    ['an object', {}],
    ['true', true],
  ])('is unknown for an instant that is %s', (_label, value) => {
    expect(check(value)).toEqual({ status: 'unknown' });
  });

  it('is unknown when the clock it is given is no date', () => {
    expect(keepaliveStatus({
      lastPingAt: instantAgo(10 * DAY),
      now: new Date(Number.NaN),
      days: 3,
    })).toEqual({ status: 'unknown' });
  });
});
