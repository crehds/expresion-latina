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

select plan(60);

-- Admin (flipped after insert, same as profiles_consent.test.sql), plus six
-- members: member_x carries the CRUD and self-write-rejected scenarios;
-- member_y and member_z prove the EXCLUDE constraint is scoped per member
-- (member_y doubles as the "another member can't read it" fixture in Group
-- 1, before Group 3 gives it any periods of its own); member_w is left
-- untouched until Group 4 so its EXCLUDE constraint can never fire for a
-- reason other than the CHECK under test; diana and erik back Group 5.
-- email_confirmed_at is set on every fixture below that must be listed
-- or payable (owner decision 2026-09-26: the directory and payments now
-- require a confirmed email in addition to recorded consent). Group 7b
-- below adds the one fixture that deliberately leaves it null.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-admin@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Reyes","consent_version":"2026-01-01"}', now(), now()
);
update public.profiles set is_admin = true where id = 'a0000000-0000-0000-0000-000000000001';

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-x@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member X","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-y@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Y","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-z@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Z","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-w@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member W","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'diana-cross@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Diana Cross","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'erik-fields@example.com', now(),
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

-- The rule holds when an admin CORRECTS a period too, not only when one is
-- recorded: moving the start of member_y's February period back one day makes
-- it share January 31st with the January one. A rejected correction must also
-- leave the stored row as it was.
select throws_ok(
  $$update public.paid_periods set starts_on = '2026-01-31' where member_id = 'a0000000-0000-0000-0000-000000000003' and ends_on = '2026-02-28'$$,
  '23P01',
  null,
  'correcting a period so that it overlaps another one of the same member is rejected'
);

select is(
  (select starts_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000003' and ends_on = '2026-02-28'),
  '2026-02-01'::date,
  'the overlapping correction leaves starts_on unchanged'
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

-- Reversed range rejected (paid_periods_ordered CHECK): before this
-- constraint existed, a reversed range only failed inside daterange()
-- when the EXCLUDE constraint below built its index entry, with a
-- generic data_exception (22000) instead of a clear check_violation.
select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000005', '2035-06-20', '2035-06-10')$$,
  '23514',
  null,
  'inserting a period with ends_on before starts_on is rejected'
);

select lives_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000005', '2035-06-10', '2035-06-10')$$,
  'a one-day period (ends_on = starts_on) is accepted'
);

select throws_ok(
  $$update public.paid_periods set ends_on = '2035-06-09' where member_id = 'a0000000-0000-0000-0000-000000000005' and starts_on = '2035-06-10'$$,
  '23514',
  null,
  'correcting a period to move ends_on before starts_on is rejected'
);

select is(
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000005' and starts_on = '2035-06-10'),
  '2035-06-10'::date,
  'the rejected correction leaves ends_on unchanged'
);

-- And a correction cannot stretch a period past 5 years either. member_w's
-- first period is exactly 5 years (2026-01-01 to 2031-01-01), so one more day
-- is the smallest step over; it is the only rule this correction breaks.
select throws_ok(
  $$update public.paid_periods set ends_on = '2031-01-02' where member_id = 'a0000000-0000-0000-0000-000000000005' and starts_on = '2026-01-01'$$,
  '23514',
  null,
  'correcting a period to run one day over 5 years is rejected'
);

select is(
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000005' and starts_on = '2026-01-01'),
  '2031-01-01'::date,
  'the 5-year correction leaves ends_on unchanged'
);

reset role;

-- ============================================================
-- Group 5: admin_search_members (Design Interfaces; Spec Member Directory)
-- ============================================================
-- Fixtures inserted directly as postgres (bypasses RLS, same convention as
-- the auth.users fixtures above): diana's window straddles "today" by
-- construction (today-5 .. today+30), erik's sits entirely in the past
-- (today-90 .. today-60). Both hold regardless of which day the suite
-- runs. The inserts below call private.lima_today() directly, which only
-- works because they run as postgres: the file starts as postgres, and the
-- `reset role` that closes Group 4 puts the session back there after the
-- impersonated groups above (the first `set local role authenticated` is in
-- Group 1). Keep that `reset role`: as `authenticated` these inserts fail,
-- since that function is granted to nobody (Design: only ever called from
-- inside other SECURITY DEFINER bodies, which run as postgres), so no
-- impersonated scenario elsewhere in this file could call it the same way.
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

-- admin_search_members input hardening: lim must be a real, bounded page
-- size. NULL previously disabled the LIMIT clause entirely (returning
-- every consented member in one call), 0 silently returned an empty
-- result (LIMIT 0 is valid SQL), and anything above 200 was accepted
-- without complaint -- none of those raised a catchable error.
select throws_ok(
  $$select * from public.admin_search_members('e', null)$$,
  '22023',
  null,
  'admin_search_members rejects a NULL lim'
);

select throws_ok(
  $$select * from public.admin_search_members('e', 0)$$,
  '22023',
  null,
  'admin_search_members rejects a lim of 0'
);

select throws_ok(
  $$select * from public.admin_search_members('e', 201)$$,
  '22023',
  null,
  'admin_search_members rejects a lim above 200'
);

select lives_ok(
  $$select * from public.admin_search_members('e', 1)$$,
  'admin_search_members accepts a lim of 1'
);

select lives_ok(
  $$select * from public.admin_search_members('e', 200)$$,
  'admin_search_members accepts a lim of 200'
);

-- A NULL or whitespace-only query now normalizes to '' (coalesce(btrim(q),
-- '')) and lists every consented member, the same as an explicit ''. The
-- expected count is a subquery, not a literal: a seeded local-dev member
-- (supabase/seed.sql) is already consented and outside this file's own
-- fixtures, so "every consented member" is whatever that count actually
-- is, not just the fixtures inserted above. Before the fix, a NULL query
-- listed nobody (position(NULL in ...) is NULL, never > 0).
-- The expected count now joins auth.users too (owner decision
-- 2026-09-26): "every consented member" changed meaning to "every
-- consented, email-confirmed member" once the directory's WHERE clause
-- gained the same second condition -- `authenticated` has no grant on
-- auth.users at all, so the count is computed as postgres (`reset role`)
-- and stashed in a custom GUC, the same mechanism this file already
-- uses for request.jwt.claims, so it survives the
-- switch back to the authenticated admin below. The previous revision of
-- this test computed the count AND called admin_search_members both
-- after the same `reset role`, so the call itself also ran as postgres --
-- a superuser bypasses admin_search_members' own EXECUTE grant check the
-- same way it bypasses the auth.users grant, so that version proved
-- nothing about whether an AUTHENTICATED admin can actually call this
-- function.
reset role;

select set_config(
  'test.expected_listed_member_count',
  (
    select count(*)::int
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.consent_at is not null and u.email_confirmed_at is not null
  )::text,
  true
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.admin_search_members(null, 50)),
  current_setting('test.expected_listed_member_count')::int,
  'a NULL query lists every consented, email-confirmed member, called as the authenticated admin'
);

select is(
  (select count(*)::int from public.admin_search_members('', 50)),
  current_setting('test.expected_listed_member_count')::int,
  'an empty-string query lists every consented, email-confirmed member, called as the authenticated admin'
);

select is(
  (select count(*)::int from public.admin_search_members('   ', 50)),
  current_setting('test.expected_listed_member_count')::int,
  'a whitespace-only query lists every consented, email-confirmed member, called as the authenticated admin'
);

-- Deterministic order: two members sharing a full_name must still come
-- back in a stable order (by id) instead of whatever order a GROUP BY
-- happens to produce, so truncating at lim never drops an arbitrary one
-- of a tied pair. Inserted as postgres (reset role first, same convention
-- as Groups 6/7 below): `authenticated` has no INSERT on auth.users at
-- all, admin included.
reset role;

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tied-name-a@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Tied Name","consent_version":"2026-01-01"}', now(), now()
);
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tied-name-b@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Tied Name","consent_version":"2026-01-01"}', now(), now()
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.admin_search_members('Tied Name', 50)),
  2,
  'both tied-name members match the search'
);

select is(
  (select id from public.admin_search_members('Tied Name', 50) offset 0 limit 1),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'the first tied-name match is the lower id'
);

select is(
  (select id from public.admin_search_members('Tied Name', 50) offset 1 limit 1),
  'a0000000-0000-0000-0000-00000000000b'::uuid,
  'the second tied-name match is the higher id'
);

select is(
  (select id from public.admin_search_members('Tied Name', 1)),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'truncating tied-name matches at lim keeps the lower id first'
);

reset role;

-- ============================================================
-- Group 6: Correcting Paid Periods -- status follows the corrected
-- period, read through admin_search_members (Spec: Correcting Paid
-- Periods, "the member's status MUST be evaluated against the corrected
-- period"). One member is followed through record -> correct -> delete
-- so every assertion proves status is recomputed from the CURRENT row,
-- not read from a second, uncorrected fixture. `(now() at time zone
-- 'America/Lima')::date` duplicates private.lima_today()'s own
-- expression: that function is granted to nobody (Design), so it cannot
-- be called while impersonating the admin the way this group does -- the
-- plain expression needs no grant and is stable within one transaction,
-- same as the function.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-member-v@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member V","consent_version":"2026-01-01"}', now(), now()
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.paid_periods (member_id, starts_on, ends_on) values (
  'a0000000-0000-0000-0000-000000000008',
  (now() at time zone 'America/Lima')::date - 5,
  (now() at time zone 'America/Lima')::date + 30
);

select is(
  (select is_active from public.admin_search_members('pp-member-v', 50) limit 1),
  true,
  'the member is active while their recorded period covers today'
);

select is(
  (select paid_until from public.admin_search_members('pp-member-v', 50) limit 1),
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000008'),
  'paid_until matches the original period end date'
);

update public.paid_periods
set
  ends_on = (now() at time zone 'America/Lima')::date - 1
where
  member_id = 'a0000000-0000-0000-0000-000000000008';

select is(
  (select is_active from public.admin_search_members('pp-member-v', 50) limit 1),
  false,
  'after the admin shortens the period to end before today, status flips to inactive immediately'
);

select is(
  (select paid_until from public.admin_search_members('pp-member-v', 50) limit 1),
  (select ends_on from public.paid_periods where member_id = 'a0000000-0000-0000-0000-000000000008'),
  'paid_until follows the corrected end date, not the original one'
);

delete from public.paid_periods
where
  member_id = 'a0000000-0000-0000-0000-000000000008';

select is(
  (select count(*)::int from public.admin_search_members('pp-member-v', 50)),
  1,
  'the member still appears in the directory after their only recorded period is deleted'
);

select is(
  (select paid_until from public.admin_search_members('pp-member-v', 50) limit 1),
  null::date,
  'paid_until is null once no period remains'
);

select is(
  (select is_active from public.admin_search_members('pp-member-v', 50) limit 1),
  false,
  'is_active is false once no period remains'
);

reset role;

-- ============================================================
-- Group 7: the member directory lists consented members only. A pending
-- account (created by Google sign-in before the person accepts the
-- privacy notice) has no recorded consent, is deleted automatically by
-- the pending-consent purge (PR3) if the person never accepts, and would
-- otherwise expose the email of someone who never agreed to anything.
-- email_confirmed_at is set here even though the fixture is pending: a
-- real Google sign-in confirms the address immediately (the provider
-- already verified it), so this isolates the missing-consent clause
-- from the confirmed-email clause added in Group 7b below -- exclusion
-- here is explained by consent alone.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-pending-google@example.com', now(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Visitor"}', now(), now()
);

select is(
  (select consent_at from public.profiles where id = 'a0000000-0000-0000-0000-000000000009'),
  null::timestamptz,
  'the fixture is a pending account with no recorded consent'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.admin_search_members('pp-pending-google', 50)),
  0,
  'a pending account with no recorded consent is invisible to the directory even when its email matches'
);

-- ============================================================
-- Group 8: the same owner decision also gates payments -- an admin
-- cannot record a paid period for a member who has not consented, so a
-- payment can never be attached to an account the hourly purge (PR3) is
-- about to delete.
-- ============================================================
select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-000000000009', '2026-01-01', '2026-01-31')$$,
  '42501',
  null,
  'an admin cannot record a paid period for a member who has not recorded consent'
);

reset role;

-- ============================================================
-- Group 7b: the directory and payments also require a CONFIRMED email
-- (owner decision 2026-09-26, extending the consented-only rule above).
-- An email/password sign-up records consent_at immediately -- BEFORE
-- the address is ever confirmed -- so this fixture is genuinely
-- consented, unlike Group 7's pending-google fixture, isolating the
-- confirmed-email clause on its own. Without this rule, this member
-- would be listed and payable today, and PR3a's 7-day unconfirmed-email
-- purge would then cascade-delete any payment recorded here with no
-- trace.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pp-unconfirmed-email@example.com', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Emailer","consent_version":"2026-01-01"}', now(), now()
);

select ok(
  (select consent_at is not null from public.profiles where id = 'a0000000-0000-0000-0000-00000000000c'),
  'the fixture has recorded consent -- email sign-up consents immediately, unlike the pending-google fixture above'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.admin_search_members('unconfirmed-email', 50)),
  0,
  'a consented account with an unconfirmed email is invisible to the directory even when its email matches'
);

select throws_ok(
  $$insert into public.paid_periods (member_id, starts_on, ends_on) values ('a0000000-0000-0000-0000-00000000000c', '2026-01-01', '2026-01-31')$$,
  '42501',
  null,
  'an admin cannot record a paid period for a consented member whose email is unconfirmed'
);

reset role;

select * from finish();

rollback;
