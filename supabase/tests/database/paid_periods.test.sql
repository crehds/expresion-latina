-- Paid periods + member directory (Design: D3 period arithmetic, D9 admin
-- model, Database Security Contract; Spec: Member Directory, Recording Paid
-- Periods, Correcting Paid Periods, Payment Privilege Restriction).
--
-- Fixtures are inserted directly into `auth.users` as `postgres` (same
-- convention as profiles_consent.test.sql), all with immediate email-signup
-- consent so every fixture has a usable `full_name`. Impersonation for RLS
-- scenarios uses `set local role authenticated` plus `set local
-- request.jwt.claims` carrying the `sub` claim `auth.uid()` reads; both can
-- be re-issued any number of times in the same transaction to switch
-- identity (Gotcha, PR1a). No SAVEPOINT/ROLLBACK TO SAVEPOINT anywhere
-- (undoes pgTAP's own test-count bookkeeping) -- the outer `rollback;`
-- guarantees nothing this file creates survives it.
begin;

select plan(27);

-- Admin (flipped after insert, same as profiles_consent.test.sql), plus six
-- members: member_x carries the CRUD and self-write-rejected scenarios;
-- member_y and member_z prove the EXCLUDE constraint is scoped per member
-- (member_y doubles as the "another member can't read it" fixture in Group
-- 1, before Group 3 gives it any periods of its own); member_w is left
-- untouched until Group 4 so its EXCLUDE constraint can never fire for a
-- reason other than the CHECK under test; diana and erik back Group 5.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-admin@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Reyes","consent_version":"2026-01-01"}', now(), now()
);
update public.profiles set is_admin = true where id = 'a0000000-0000-0000-0000-000000000001';

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-x@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member X","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-y@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Y","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-z@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Z","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-w@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member W","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'diana-cross@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Diana Cross","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'erik-fields@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Erik Fields","consent_version":"2026-01-01"}', now(), now()
);

-- ============================================================
-- Group 1: admin CRUD, member read scope (Database Security Contract)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000002', '2026-01-01', '2026-01-31')$$,
  'an admin can record a paid period for a member'
);

select is(
  (select recorded_by from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'recorded_by defaults to the admin who created the row'
);

select lives_ok(
  $$update public.paid_periods set ends_on = '2026-02-15' where member_id = 'a0000000-0000-0000-0000-000000000002'$$,
  'an admin can correct a period''s end date'
);

select is(
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  '2026-02-15'::date,
  'the correction is applied immediately'
);

select is(
  (select recorded_by from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'correcting starts_on/ends_on does not change recorded_by'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  1,
  'a member can select their own paid period'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::int from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  0,
  'a member cannot select another member''s paid period'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$delete from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'$$,
  'an admin can delete a recorded paid period'
);

select is(
  (select count(*)::int from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  0,
  'the deleted period is gone'
);

reset role;

-- ============================================================
-- Group 2: member self-write rejected (Payment Privilege Restriction)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Fixture for this group only: an admin-recorded period member_x can then
-- try (and fail) to write to.
insert into public.paid_periods (member_id, starts_on, ends_on) values (
  'a0000000-0000-0000-0000-000000000002', '2026-03-01', '2026-03-31'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000002', '2026-04-01', '2026-04-30')$$,
  '42501',
  null,
  'a member cannot insert their own paid period'
);

-- INSERT's WITH CHECK raises on the new row itself, but UPDATE/DELETE's
-- USING clause silently filters out every row for a non-admin -- there is
-- nothing to raise on, so these are asserted by re-reading the row instead
-- of throws_ok (same pattern as the profiles_consent.test.sql blocked
-- full_name update).
update public.paid_periods
set
  ends_on = '2026-04-30'
where
  member_id = 'a0000000-0000-0000-0000-000000000002';

select is(
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  '2026-03-31'::date,
  'a member cannot update their own recorded paid period'
);

delete from public.paid_periods
where
  member_id = 'a0000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000002'),
  1,
  'a member cannot delete their own recorded paid period'
);

reset role;

-- ============================================================
-- Group 3: overlap rejected, scoped per member (Design D3)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000003', '2026-01-01', '2026-01-31')$$,
  'an admin can record the first period for member_y'
);

select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000003', '2026-01-15', '2026-02-15')$$,
  '23P01',
  null,
  'a period overlapping member_y''s existing period is rejected'
);

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000004', '2026-01-15', '2026-02-15')$$,
  'the same date range for a DIFFERENT member (member_z) does not overlap'
);

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000003', '2026-02-01', '2026-02-28')$$,
  'a back-to-back period for member_y (no shared day) does not overlap'
);

reset role;

-- ============================================================
-- Group 4: >5 years rejected (Design D3, typo guard)
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000005', '2026-01-01', '2031-01-01')$$,
  'a period exactly 5 years long is accepted'
);

select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000005', '2032-01-01', '2037-01-02')$$,
  '23514',
  null,
  'a period one day over 5 years is rejected'
);

reset role;

-- ============================================================
-- Group 5: admin_search_members (Design Interfaces; Spec Member Directory)
-- ============================================================
-- Fixtures inserted directly as postgres (bypasses RLS, same convention as
-- the auth.users fixtures above): diana's window straddles "today" by
-- construction (today-5 .. today+30), erik's sits entirely in the past
-- (today-90 .. today-60). Both hold regardless of which day the suite
-- runs, without the test itself ever needing to call private.lima_today()
-- -- that function is granted to nobody (Design: only called from inside
-- other SECURITY DEFINER bodies, which run as postgres).
insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values (
  'a0000000-0000-0000-0000-000000000006',
  private.lima_today () - 5,
  private.lima_today () + 30,
  'a0000000-0000-0000-0000-000000000001'
);
insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values (
  'a0000000-0000-0000-0000-000000000007',
  private.lima_today () - 90,
  private.lima_today () - 60,
  'a0000000-0000-0000-0000-000000000001'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from public.admin_search_members('e', 50)$$,
  '42501',
  null,
  'a non-admin cannot call admin_search_members'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.admin_search_members('iana', 50)),
  1,
  'searching a partial name finds exactly the matching member'
);

select is(
  (select is_active from public.admin_search_members('iana', 50) limit 1),
  true,
  'a member whose window covers today is reported active'
);

select is(
  (select paid_until from public.admin_search_members('iana', 50) limit 1),
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000006'),
  'paid_until matches the member''s stored period end date'
);

select is(
  (select count(*)::int from public.admin_search_members('erik-fi', 50)),
  1,
  'searching a partial email finds exactly the matching member'
);

select is(
  (select is_active from public.admin_search_members('erik-fi', 50) limit 1),
  false,
  'a member whose window has already ended is reported inactive'
);

select is(
  (select paid_until from public.admin_search_members('erik-fi', 50) limit 1),
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000007'),
  'paid_until matches the inactive member''s stored period end date too'
);

-- Neither fixture's name or email contains a literal '%' or '_': under
-- ILIKE these would match everything (any non-empty string), so a non-zero
-- count here would mean the search stopped using position() semantics.
select is(
  (select count(*)::int from public.admin_search_members('%', 50)),
  0,
  '%% is matched as a literal character, not a wildcard'
);

select is(
  (select count(*)::int from public.admin_search_members('_', 50)),
  0,
  '_ is matched as a literal character, not a wildcard'
);

reset role;

select * from finish();

rollback;
