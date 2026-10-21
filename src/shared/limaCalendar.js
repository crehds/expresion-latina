/**
 * ISO-date math and the Lima today/instant (Design D3).
 *
 * Every period and status computation in the app works on plain
 * `'YYYY-MM-DD'` strings, on the Lima calendar, rather than on a JS `Date`.
 * `todayInLima` is the one function here that takes a `Date` -- an instant,
 * passed in explicitly, never read from the clock itself -- so every other
 * function in the domain stays pure and deterministic under a fixed `now`.
 *
 * All the arithmetic below runs through `Date.UTC` / `getUTC*`, never a
 * local-time getter, so the result never depends on the host machine's own
 * time zone (CI runs in UTC; a developer's machine may not).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// America/Lima has kept a fixed UTC-05:00 offset since 1990, with no DST --
// the same convention documented next to `private.lima_today()`
// (supabase/migrations/20260924140000_paid_periods.sql) and the
// `set_attendance_starts_at` trigger
// (supabase/migrations/20260924150000_attendance_confirmations.sql). A fixed
// offset is used here rather than a time zone database lookup because the
// two must agree, and the SQL side has no access to one.
const LIMA_UTC_OFFSET_HOURS = 5;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Parses a `'YYYY-MM-DD'` string into a UTC timestamp, rejecting anything
 * that is not a real calendar date. `Date.UTC` alone would silently roll
 * '2026-02-30' into '2026-03-02'; comparing the constructed date's own
 * fields back against the input catches that.
 *
 * @param {string} isoDate
 * @returns {number} milliseconds since epoch, at UTC midnight of that date
 */
function parseIsoDate(isoDate) {
  if (typeof isoDate !== 'string' || !ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`Expected an ISO date ('YYYY-MM-DD'), got: ${JSON.stringify(isoDate)}`);
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  const isRealDate = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;

  if (!isRealDate) {
    throw new Error(`Not a real calendar date: ${isoDate}`);
  }

  return timestamp;
}

function formatIsoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Parses a 24-hour `'HH:MM'` string, rejecting anything outside 00:00-23:59
 * (no single-digit hour, no ':60').
 *
 * @param {string} time
 * @returns {{hours: number, minutes: number}}
 */
function parseTime(time) {
  const match = typeof time === 'string' ? TIME_PATTERN.exec(time) : null;

  if (!match) {
    throw new Error(`Expected a time ('HH:MM', 00-23:00-59), got: ${JSON.stringify(time)}`);
  }

  const [, hours, minutes] = match;
  return { hours: Number(hours), minutes: Number(minutes) };
}

/** The number of days in a given UTC year and zero-based month. */
function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Whether `value` is an ISO date string ('YYYY-MM-DD') that names a real
 * calendar day: the question a form asks of what was typed before it is used,
 * answered with the same rules as every function here, and never by throwing.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIsoDate(value) {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's date on the Lima calendar, for a given instant.
 *
 * @param {Date} now the instant to read; never read from the clock here
 * @returns {string} an ISO date, e.g. '2026-09-27'
 */
export function todayInLima(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error(`Expected a valid Date, got: ${now}`);
  }

  return formatIsoDate(now.getTime() - LIMA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Adds whole days to an ISO date. A negative count subtracts.
 *
 * @param {string} isoDate
 * @param {number} days may be negative; must be an integer
 * @returns {string} an ISO date
 */
export function addDays(isoDate, days) {
  const timestamp = parseIsoDate(isoDate);

  if (!Number.isInteger(days)) {
    throw new Error(`days must be an integer, got: ${days}`);
  }

  return formatIsoDate(timestamp + days * MS_PER_DAY);
}

/**
 * The same day-of-month, `months` later. A day that does not exist in the
 * target month (31 Jan + 1 month has no 31 Feb) rolls forward to the 1st of
 * the month after that one, rather than clamping to the target month's own
 * last day (Design D3: clamping and then subtracting a day, as `endAfter`
 * does, would turn 31 Jan into 27 Feb -- one day short of the month the
 * member actually paid for).
 *
 * @param {string} isoDate
 * @param {number} months must be a positive integer
 * @returns {string} an ISO date
 */
export function anniversary(isoDate, months) {
  const timestamp = parseIsoDate(isoDate);

  if (!Number.isInteger(months) || months <= 0) {
    throw new Error(`months must be a positive integer, got: ${months}`);
  }

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const day = date.getUTCDate();
  const targetMonth = date.getUTCMonth() + months;

  if (day > daysInMonth(year, targetMonth)) {
    return formatIsoDate(Date.UTC(year, targetMonth + 1, 1));
  }

  return formatIsoDate(Date.UTC(year, targetMonth, day));
}

/**
 * The calendar weekday of an ISO date, 0-6 with 0 = Sunday -- the same
 * convention as `day.weekday` (src/data), `getSessionsForWeekday`
 * (src/data/selectors.js) and `Date#getDay()`. A plain UTC read is correct
 * here (unlike `todayInLima`): this asks which weekday a calendar date
 * itself falls on, not what the Lima clock currently reads.
 *
 * @param {string} isoDate
 * @returns {number}
 */
export function weekdayOf(isoDate) {
  return new Date(parseIsoDate(isoDate)).getUTCDay();
}

/**
 * The instant at which the Lima wall clock shows `time` on `isoDate` -- the
 * JS half of the `set_attendance_starts_at` trigger's
 * `(class_date + start_time) at time zone 'America/Lima'`
 * (supabase/migrations/20260924150000_attendance_confirmations.sql). The
 * two must agree bit-for-bit, since the database recomputes the same
 * instant server-side from the same two inputs.
 *
 * @param {string} isoDate
 * @param {string} time 'HH:MM', 24-hour
 * @returns {Date}
 */
export function limaInstant(isoDate, time) {
  const midnightUtc = parseIsoDate(isoDate);
  const { hours, minutes } = parseTime(time);
  const minutesSinceLimaMidnight = hours * 60 + minutes;

  return new Date(midnightUtc + (minutesSinceLimaMidnight + LIMA_UTC_OFFSET_HOURS * 60) * 60000);
}
