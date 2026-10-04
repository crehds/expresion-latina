/**
 * Schedule match (Design D1, spec "Schedule Changes").
 *
 * A confirmation pins one occurrence -- (classDate, startTime, genreId,
 * roomKey) -- and the database never learns the schedule. When the academy
 * changes a class's day, start time, genre or room, the confirmations for
 * its upcoming occurrences describe a class that no longer exists. The admin
 * finds them by diffing, on the client, the confirmations against the keys
 * the current schedule produces. Changing the teacher, level, note or end
 * time changes no part of the key, so those confirmations keep matching.
 *
 * The schedule selector is injected: the domain never imports `src/data`.
 */

import { addDays, weekdayOf } from '../../../shared/limaCalendar';
import { occurrenceKey, occurrenceOn } from './occurrences';

/**
 * The occurrence keys the current schedule produces for every Lima calendar
 * date in `[fromDate, toDate]` (both inclusive). Built only through
 * `occurrenceOn` / `occurrenceKey`, so it can never disagree with how a
 * confirmation's own key is built.
 *
 * @param {(weekday: number) => object[]} getSessionsForWeekday the
 *   `getSessionsForWeekday` selector of src/data/selectors.js (0 = Sunday)
 * @param {string} fromDate ISO date, the first day
 * @param {string} toDate ISO date, the last day; not before `fromDate`
 * @returns {Set<string>}
 */
export function expectedOccurrenceKeys(getSessionsForWeekday, fromDate, toDate) {
  if (typeof getSessionsForWeekday !== 'function') {
    throw new Error('Expected getSessionsForWeekday to be a function.');
  }

  // weekdayOf validates each bound; an ISO date sorts like the calendar.
  weekdayOf(fromDate);
  weekdayOf(toDate);
  if (fromDate > toDate) {
    throw new Error(`The range is inverted: ${fromDate} is after ${toDate}.`);
  }

  const keys = new Set();
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    getSessionsForWeekday(weekdayOf(date)).forEach((session) => {
      keys.add(occurrenceKey(occurrenceOn(session, date)));
    });
  }

  return keys;
}

function keyOfConfirmation(confirmation) {
  const fields = ['classDate', 'startTime', 'genreId', 'roomKey'];
  const isComplete = confirmation !== null
    && typeof confirmation === 'object'
    && fields.every((field) => typeof confirmation[field] === 'string' && confirmation[field] !== '');

  if (!isComplete) {
    throw new Error(
      `Expected a confirmation with ${fields.join(', ')}, got: ${JSON.stringify(confirmation)}`,
    );
  }

  return occurrenceKey(confirmation);
}

/**
 * Splits confirmations into those whose occurrence still exists in the
 * schedule and those that no longer match it.
 *
 * @param {object[]} confirmations camelCase domain confirmations, each with string
 *   classDate, startTime ('HH:MM'), genreId and roomKey
 * @param {Set<string>} expectedKeys from `expectedOccurrenceKeys`
 * @returns {{
 *   byOccurrence: Map<string, object[]>, mismatched: object[],
 * }} `byOccurrence` groups the matching confirmations by occurrence key;
 *   `mismatched` holds the rest. Both keep the input order.
 */
export function flagScheduleMismatch(confirmations, expectedKeys) {
  if (!Array.isArray(confirmations)) {
    throw new Error('Expected confirmations to be an array.');
  }
  if (!(expectedKeys instanceof Set)) {
    throw new Error('Expected expectedKeys to be a Set.');
  }

  const byOccurrence = new Map();
  const mismatched = [];

  confirmations.forEach((confirmation) => {
    const key = keyOfConfirmation(confirmation);

    if (!expectedKeys.has(key)) {
      mismatched.push(confirmation);
      return;
    }

    if (!byOccurrence.has(key)) byOccurrence.set(key, []);
    byOccurrence.get(key).push(confirmation);
  });

  return { byOccurrence, mismatched };
}
