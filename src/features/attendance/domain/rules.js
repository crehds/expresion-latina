/**
 * The attendance control state a viewer sees for one occurrence
 * (Design D4), mirroring the RLS policies in
 * supabase/migrations/20260924150000_attendance_confirmations.sql:
 * `confirm_own` (consent + not started + within 7 days + can_confirm) and
 * `cancel_own_before_start` (consent + not started), with the administrator
 * branch of supabase/migrations/20261022120000_attendance_admin_free_access.sql:
 * `confirm_own` lets an administrator through its last clause without a paid
 * period.
 */

import { todayInLima } from '../../../shared/limaCalendar';
import { isActiveOn } from '../../membership/domain/rules';
import { occurrenceKey } from './occurrences';

const CONFIRM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {object} params
 * @param {object} params.occurrence one occurrence, from occurrenceOn/nextOccurrence
 * @param {Date} params.now
 * @param {{periods: {startsOn: string, endsOn: string}[]}|null} params.membership
 *   null for a visitor; otherwise a signed-in, consented member's paid periods
 * @param {Set<string>} params.confirmedKeys occurrence keys (occurrenceKey)
 *   the member has already confirmed
 * @param {boolean} [params.isAdmin] whether the viewer is an administrator, who
 *   has free access to classes: never `inactive` or `uncovered`. Only the exact
 *   `true` counts, and the database stays the authority.
 * @returns {'hidden'|'inactive'|'uncovered'|'confirm'|'cancel'|'started'}
 */
// eslint-disable-next-line import/prefer-default-export
export function controlState({
  occurrence, now, membership, confirmedKeys, isAdmin = false,
}) {
  if (membership == null) return 'hidden';

  const nowMs = now.getTime();

  // confirm_own and cancel_own_before_start both require starts_at > now().
  if (occurrence.startsAt.getTime() <= nowMs) return 'started';

  // cancel_own_before_start needs only consent + not started, so a member
  // who has since gone inactive can still cancel.
  if (confirmedKeys.has(occurrenceKey(occurrence))) return 'cancel';

  // confirm_own's WITH CHECK bounds starts_at <= now() + interval '7 days'.
  if (occurrence.startsAt.getTime() > nowMs + CONFIRM_WINDOW_MS) return 'hidden';

  // An administrator needs no paid period: the window and the start, checked
  // above, are the only rules left for them.
  if (isAdmin === true) return 'confirm';

  const { periods } = membership;

  if (!isActiveOn(periods, todayInLima(now))) return 'inactive';
  if (!isActiveOn(periods, occurrence.classDate)) return 'uncovered';

  return 'confirm';
}
