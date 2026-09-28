import { addDays, anniversary } from '../../../shared/limaCalendar';

/**
 * Pure membership rules over paid periods (Design D3, D4).
 *
 * A period is `{ startsOn, endsOn }`: ISO dates on the Lima calendar,
 * inclusive at both ends. Mapping the database's snake_case columns
 * (`starts_on`, `ends_on`) into this shape is an adapter's job (PR7);
 * nothing here knows about the database.
 *
 * @typedef {{ startsOn: string, endsOn: string }} Period
 */

/** The latest of a non-empty list of ISO dates. */
function latestOf(isoDates) {
  return isoDates.reduce((latest, isoDate) => (isoDate > latest ? isoDate : latest));
}

/**
 * Whether some period covers `isoDate`, inclusive at both ends. Mirrors
 * `admin_search_members.is_active`
 * (supabase/migrations/20260924140000_paid_periods.sql).
 *
 * @param {Period[]} periods
 * @param {string} isoDate
 * @returns {boolean} false for an empty list
 */
export function isActiveOn(periods, isoDate) {
  return periods.some((period) => period.startsOn <= isoDate && period.endsOn >= isoDate);
}

/**
 * The latest `endsOn` across every period a member has ever had -- past,
 * current or future. Mirrors `admin_search_members.paid_until`
 * (supabase/migrations/20260924140000_paid_periods.sql).
 *
 * @param {Period[]} periods
 * @returns {string|null} null when there are no periods
 */
export function paidUntil(periods) {
  if (periods.length === 0) return null;

  return latestOf(periods.map((period) => period.endsOn));
}

/**
 * The date a new payment period should start: the day after the latest
 * `endsOn` among periods that have not yet ended -- which includes a
 * future, already-prepaid period -- so a renewal never re-pays days
 * already covered ("Renewal keeps no days"); `today` when there is no
 * such period.
 *
 * @param {Period[]} periods
 * @param {string} today
 * @returns {string} an ISO date
 */
export function defaultStart(periods, today) {
  const openEndsOn = periods
    .map((period) => period.endsOn)
    .filter((endsOn) => endsOn >= today);

  if (openEndsOn.length === 0) return today;

  return addDays(latestOf(openEndsOn), 1);
}

/**
 * The end date of an `N`-month period starting on `start`, inclusive: the
 * anniversary minus one day (Design D3), e.g. 15 Jan + 1 month -> 14 Feb.
 * Used both to fill "+1 month" / "+1 year" shortcuts (PR7) and to size a
 * renewal's period once `defaultStart` has picked its start date.
 *
 * @param {string} start an ISO date
 * @param {{ months: number }} options
 * @returns {string} an ISO date
 */
export function endAfter(start, { months }) {
  return addDays(anniversary(start, months), -1);
}
