-- Administrators have free access to classes (owner decision, 2026-10-22: the
-- same button as a member, without a paid period). Proven by
-- supabase/tests/database/attendance_confirmations.test.sql (Group 17).
--
-- Only the confirm_own INSERT policy changes. An administrator now passes its
-- last clause through private.is_admin() instead of private.can_confirm(), and
-- every other clause stays exactly as it was:
--
--   * member_id = auth.uid(): a confirmation is always for the caller. member_id
--     is not in the client's INSERT column grant, so it cannot name anyone else.
--   * the 7-day window, starts_at > now() and starts_at <= now() + 7 days, still
--     bounds an administrator: no class that has started, none further ahead.
--   * consent: private.is_admin() is true only for a profile that has recorded
--     its consent, so an admin flag on an unconsented account opens nothing.
--
-- The branch lives in the policy and not inside private.can_confirm on purpose.
-- can_confirm(member, date) answers one question about one member: do their paid
-- periods allow this class. private.is_admin() always means "the caller", and
-- the policy is where member_id = auth.uid() ties the two together. Putting it in
-- the helper would make can_confirm(other_member, date) answer true for any
-- member whenever an administrator asks. The helper, its SECURITY DEFINER and
-- search_path settings and its grants stay as they are, so the catalog guard
-- (catalog_privileges.test.sql) needs no change.
--
-- Cancelling needs nothing: cancel_own_before_start never looked at a paid
-- period (consent + not started), so an administrator can already cancel.
--
-- A new file and not an edit of 20260924150000_attendance_confirmations.sql: a
-- database that already applied that migration (the owner's local stack, CI)
-- would never see an edited one, and the recent changes to this table
-- (20261020*) were new files too. ALTER POLICY changes the check and keeps the
-- policy's name and its role (authenticated).
alter policy confirm_own on public.attendance_confirmations
with check (
  member_id = (select auth.uid ())
  and starts_at > now ()
  and starts_at <= now () + interval '7 days'
  and (
    (select private.is_admin ())
    or private.can_confirm ((select auth.uid ()), class_date)
  )
);
