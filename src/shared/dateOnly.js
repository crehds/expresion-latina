/**
 * Writes a date-only value for the screen (Design D3: every period works on
 * plain 'YYYY-MM-DD' strings on the Lima calendar).
 *
 * A date-only value is a calendar day, not an instant, so it must never go
 * through `new Date('YYYY-MM-DD')` read in the machine's own zone: that is
 * midnight UTC, which is still the day before in Lima (UTC-05:00). The date is
 * built at UTC midnight from its own numbers and written in UTC, so the same
 * string reads the same day in every time zone. For an instant (a consent date,
 * a last ping) use a formatter with the Lima zone instead.
 */
import { isIsoDate } from './limaCalendar';

// 'long' is "19 de octubre de 2026", the style the account page writes its
// instants in. The zone is UTC because the date below is built in UTC.
const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * @param {string} isoDate a real calendar date, 'YYYY-MM-DD'
 * @returns {string} for example '19 de octubre de 2026'
 */
export function formatDateOnly(isoDate) {
  if (!isIsoDate(isoDate)) {
    throw new Error(`Expected an ISO date ('YYYY-MM-DD'), got: ${JSON.stringify(isoDate)}`);
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

export default formatDateOnly;
