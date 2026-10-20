/**
 * When the administrator is told that the keep-alive has not pinged the project
 * lately (Spec: Keep-Alive Failure Detection). Two pure pieces:
 *
 * - `parseAlertDays` reads the build-time variable `VITE_KEEPALIVE_ALERT_DAYS`,
 *   the number of days without a ping after which the banner appears.
 * - `keepaliveStatus` judges the instant of the last ping against that number.
 *
 * Nothing here is React, a browser API or another module: the build imports
 * `parseAlertDays` too (`vite.config.js`, through the plugin that refuses a
 * malformed value), and it must load there with nothing else behind it.
 * `parseAlertDays` returns a result and never throws because the build and the
 * banner treat a malformed value differently: the build refuses it, and the
 * banner, which can only meet one in the dev server and in tests, falls back to
 * the default.
 */

/** The threshold when the variable is not set: three days (owner decision). */
export const DEFAULT_ALERT_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A whole number of days of at least one, in digits only: no sign, no leading
// zero (which also rules out 0), no space, no decimals and no exponent.
const DAYS_PATTERN = /^[1-9][0-9]*$/;

/**
 * Reads the value of `VITE_KEEPALIVE_ALERT_DAYS`.
 *
 * - Not set, or empty: the default threshold.
 * - `off` in any case, with nothing around it: the banner is disabled.
 * - A whole number of days of at least 1 in digits only, and exact as a number
 *   (a safe integer): that threshold.
 * - Anything else, `0`, `03`, `+3`, `3.5`, `1e2`, ` 3` and a number too long to
 *   be exact included, is malformed.
 *
 * @param {unknown} value what the variable holds: text, or undefined when unset
 * @returns {{ kind: 'days', days: number } | { kind: 'off' } | { kind: 'malformed' }}
 */
export function parseAlertDays(value) {
  if (value === undefined || value === '') {
    return { kind: 'days', days: DEFAULT_ALERT_DAYS };
  }
  if (typeof value !== 'string') {
    return { kind: 'malformed' };
  }
  if (value.toLowerCase() === 'off') {
    return { kind: 'off' };
  }
  const days = DAYS_PATTERN.test(value) ? Number(value) : Number.NaN;
  return Number.isSafeInteger(days) ? { kind: 'days', days } : { kind: 'malformed' };
}

/**
 * What the banner should say about the last ping.
 *
 * - `never`: no ping is recorded.
 * - `stale`: the ping is older than `days` days, by more than a millisecond.
 *   It carries the instant of the ping and the whole days that have passed since.
 * - `fresh`: it is not older than that. Exactly the threshold is still fresh, and
 *   so is a ping in the future (a clock that is behind).
 * - `unknown`: the instant cannot be read, so nothing can be said about it.
 *
 * @param {{ lastPingAt: string | null, now: Date, days: number }} input
 *   `lastPingAt` is the instant as the database writes it (an ISO string with an
 *   offset), or null when nothing was ever recorded; `days` comes from
 *   `parseAlertDays`.
 * @returns {{ status: 'never' }
 *   | { status: 'fresh' }
 *   | { status: 'stale', lastPingAt: Date, daysAgo: number }
 *   | { status: 'unknown' }}
 */
export function keepaliveStatus({ lastPingAt, now, days }) {
  if (lastPingAt === null) {
    return { status: 'never' };
  }
  // Only text is an instant here: a number would read as milliseconds.
  const pingedAt = typeof lastPingAt === 'string' ? new Date(lastPingAt) : null;
  const elapsed = pingedAt === null ? Number.NaN : now.getTime() - pingedAt.getTime();
  if (Number.isNaN(elapsed)) {
    return { status: 'unknown' };
  }
  if (elapsed > days * MS_PER_DAY) {
    return { status: 'stale', lastPingAt: pingedAt, daysAgo: Math.floor(elapsed / MS_PER_DAY) };
  }
  return { status: 'fresh' };
}
