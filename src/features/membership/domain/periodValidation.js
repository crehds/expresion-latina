/**
 * Checks for the paid period form (Design: D3; Spec: Recording Paid Periods).
 *
 * They only save the admin a round trip. The server stays the authority: the
 * CHECK constraints of `paid_periods` and its EXCLUDE constraint (a period that
 * overlaps another one of the same member) answer for the rest, so nothing here
 * mirrors the five-year limit or the overlap rule. A one-day period is allowed
 * (the end may be the start), and so is a period in the past or in the future:
 * the form does not know what day it is.
 *
 * Results hold KEYS only, never the typed values or any copy; the form maps each
 * key to its message. The dates are the ISO 'YYYY-MM-DD' strings the whole
 * membership domain uses, compared as strings, which orders them correctly.
 */
import { isIsoDate } from '../../../shared/limaCalendar';

const isBlank = (value) => typeof value !== 'string' || value.trim() === '';

// 'required' when nothing was entered, 'invalid' when what was entered is not a
// real calendar date, null when the date is good.
function dateError(value) {
  if (isBlank(value)) {
    return 'required';
  }
  return isIsoDate(value) ? null : 'invalid';
}

/**
 * `errors` may hold `startsOn` ('required' | 'invalid') and `endsOn`
 * ('required' | 'invalid' | 'before_start'). The end is compared with the start
 * only when both are real dates.
 */
export function validatePeriod({ startsOn, endsOn } = {}) {
  const errors = {};

  const startError = dateError(startsOn);
  if (startError) {
    errors.startsOn = startError;
  }

  let endError = dateError(endsOn);
  if (!startError && !endError && endsOn < startsOn) {
    endError = 'before_start';
  }
  if (endError) {
    errors.endsOn = endError;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export default validatePeriod;
