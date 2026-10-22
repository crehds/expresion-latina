/**
 * What a viewer sees of attendance on the public schedule (Design D4): the control
 * state of one occurrence (`controlState`) and what the prompt for a member with no
 * active membership says (`membershipPrompt`).
 *
 * `controlState` mirrors the RLS policies in
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
 * Whether the viewer is to be prompted, and with what: a signed-in member whose paid
 * periods are known, who is no administrator, and who has no period covering today on
 * the Lima calendar. It is about the membership today and not about one class: a
 * member who is active today but whose period ends before a later class is told on
 * that card (`uncovered`), not by a prompt.
 *
 * - `null`: no prompt (a visitor, data not read yet, an administrator, or a period
 *   that covers today);
 * - `{ kind: 'starts-later', startsOn }`: no period covers today but one starts later;
 *   `startsOn` is the earliest start after today, and the member can ask for an
 *   earlier one (the admin moves the dates);
 * - `{ kind: 'enrol' }`: there is no period that covers today or starts later, so the
 *   member has to enrol.
 *
 * @param {object} params
 * @param {{periods: {startsOn: string, endsOn: string}[]}|null} params.membership
 *   null for a visitor, or while the periods have not been read
 * @param {Date} params.now
 * @param {boolean} [params.isAdmin] administrators have free access to classes, so
 *   they are never prompted; only the exact `true` counts
 * @returns {null | {kind: 'enrol'} | {kind: 'starts-later', startsOn: string}}
 */
export function membershipPrompt({ membership, now, isAdmin = false }) {
  if (membership == null || isAdmin === true) return null;

  const today = todayInLima(now);
  if (isActiveOn(membership.periods, today)) return null;

  const startsOn = membership.periods
    .map((period) => period.startsOn)
    .filter((day) => day > today)
    .sort()[0];

  return startsOn === undefined ? { kind: 'enrol' } : { kind: 'starts-later', startsOn };
}

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
