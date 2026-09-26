-- Attendance confirmations + the starts_at trigger (Design: D1 occurrence
-- identity, D2 the DB learns start times, D4 confirm after paid-until,
-- Database Security Contract; Spec: Confirm Attendance, Cancel Attendance).
--
-- Fixtures are inserted directly into `auth.users` as `postgres` (same
-- convention as paid_periods.test.sql), all up front, before any `set local
-- role`, so no auth.users insert ever needs a `reset role` first (Gotcha,
-- slice 2a2). Impersonation for RLS scenarios uses `set local role
-- authenticated` plus `set local request.jwt.claims` carrying the `sub`
-- claim `auth.uid()` reads; both can be re-issued any number of times in
-- the same transaction to switch identity. No SAVEPOINT/ROLLBACK TO
-- SAVEPOINT anywhere (undoes pgTAP's own test-count bookkeeping) -- the
-- outer `rollback;` guarantees nothing this file creates survives it.
--
-- `auth.uid()` is NULL while running as `postgres` (no JWT context), so
-- every fixture inserted directly (bypassing RLS) names `member_id`
-- explicitly instead of relying on its default. `private.lima_today()` is
-- granted to nobody (Design), so it is only ever called directly here
-- while still `postgres`; every date computed while impersonating
-- `authenticated` duplicates its plain expression, `(now() at time zone
-- 'America/Lima')::date`, instead (Gotcha, PR2a corrective re-run).
begin;

select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-admin@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Reyes","consent_version":"2026-01-01"}', now(), now()
);
update public.profiles set is_admin = true where id = 'b0000000-0000-0000-0000-000000000001';

-- member_a: consented, active today, and covered widely (today-5..today+30)
-- -- carries most of the Confirm/Cancel Attendance success-path scenarios.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-a@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member A","consent_version":"2026-01-01"}', now(), now()
);

-- member_b: consented, no period at all -- used only to prove it can never
-- read or write member_a's confirmations.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-b@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member B","consent_version":"2026-01-01"}', now(), now()
);

-- member_c: consented, no period at all -- "inactive member confirmation
-- rejected".
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-c@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member C","consent_version":"2026-01-01"}', now(), now()
);

-- member_d: consented, active today, but their only period ends in 2 days
-- -- Design D4 "class after paid-until" (spec: "Class after paid-until
-- rejected").
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-d@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member D","consent_version":"2026-01-01"}', now(), now()
);

-- member_e: a PENDING Google account (no recorded consent) that a
-- postgres-bypassed fixture below still gives a period covering today, so
-- the "consent" clause of private.can_confirm can be isolated from the
-- "active" and "covered" clauses, which would otherwise also be true.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-e@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Member E"}', now(), now()
);

-- member_f: consented; needs no period at all, because its only row is
-- inserted directly below (bypassing RLS entirely) with a class_date/
-- start_time already in the past -- confirm_own's own window could never
-- produce that row, but the trigger under test must still compute a
-- genuine past starts_at for it.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ac-member-f@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member F","consent_version":"2026-01-01"}', now(), now()
);

insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values (
  'b0000000-0000-0000-0000-000000000002',
  private.lima_today () - 5,
  private.lima_today () + 30,
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values (
  'b0000000-0000-0000-0000-000000000005',
  private.lima_today () - 5,
  private.lima_today () + 2,
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values (
  'b0000000-0000-0000-0000-000000000006',
  private.lima_today () - 5,
  private.lima_today () + 30,
  'b0000000-0000-0000-0000-000000000001'
);

-- ============================================================
-- Group 1: the starts_at trigger computes the Lima wall-clock instant
-- (Design D2). Inserted directly as postgres (bypasses RLS and the
-- confirm_own window entirely) to isolate the trigger's own arithmetic
-- from every policy below it. The expected value is built with an
-- explicit UTC-05:00 offset literal -- a different code path than the
-- trigger's own "AT TIME ZONE" conversion -- so this is a real,
-- independent check, not the same formula compared to itself. America/
-- Lima has no DST (fixed offset), so both rows below hold regardless of
-- when the suite runs.
-- ============================================================
insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'b0000000-0000-0000-0000-000000000002', '2026-10-05', '14:00', '15:00', 'salsa', 'room-a', 'Salsa', 'Room A'
);

select is(
  (select starts_at from public.attendance_confirmations where genre_id = 'salsa' and room_key = 'room-a'),
  '2026-10-05 14:00:00-05:00'::timestamptz,
  'the starts_at trigger computes the Lima wall-clock instant for an evening class'
);

insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'b0000000-0000-0000-0000-000000000002', '2026-10-05', '23:15', '23:59', 'bachata', 'room-b', 'Bachata', 'Room B'
);

select is(
  (select starts_at from public.attendance_confirmations where genre_id = 'bachata' and room_key = 'room-b'),
  '2026-10-05 23:15:00-05:00'::timestamptz,
  'the starts_at trigger is correct across the UTC day boundary too (23:15 Lima is 04:15 UTC the next day)'
);

-- ============================================================
-- Group 2: Confirm Attendance -- within window and covered (spec:
-- "Confirm within window"), then a duplicate confirm of the exact same
-- occurrence (Design D1: 23505, the future adapter treats it as
-- idempotent).
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
    values ((now() at time zone 'America/Lima')::date + 3, '19:00', '20:00', 'salsa', 'studio-1', 'Salsa', 'Studio 1')$$,
  'an active member can confirm a class in 3 days that their paid period covers'
);

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-1'),
  1,
  'the confirmation is recorded'
);

select throws_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
    values ((now() at time zone 'America/Lima')::date + 3, '19:00', '20:00', 'salsa', 'studio-1', 'Salsa', 'Studio 1')$$,
  '23505',
  null,
  'confirming the exact same occurrence twice is rejected as a duplicate'
);

-- ============================================================
-- Group 3: Confirm Attendance -- outside the 7-day window rejected (spec
-- scenario), even though member_a is otherwise active and covered through
-- day+30.
-- ============================================================
select throws_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
    values ((now() at time zone 'America/Lima')::date + 10, '19:00', '20:00', 'bachata', 'studio-2', 'Bachata', 'Studio 2')$$,
  '42501',
  null,
  'confirming a class occurring in 10 days is rejected even though the period covers it'
);

reset role;

-- ============================================================
-- Group 4: Confirm Attendance -- inactive member confirmation rejected
-- (spec scenario), regardless of client-side state.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
    values ((now() at time zone 'America/Lima')::date + 2, '19:00', '20:00', 'salsa', 'studio-3', 'Salsa', 'Studio 3')$$,
  '42501',
  null,
  'a member with no active paid period cannot confirm any class'
);

reset role;

select is(
  private.can_confirm ('b0000000-0000-0000-0000-000000000004', private.lima_today ()),
  false,
  'can_confirm is false for a member with no paid period at all'
);

-- ============================================================
-- Group 5: Confirm Attendance -- Design D4, "class after paid-until"
-- rejected (spec: "Class after paid-until rejected"). member_d is active
-- today (period ends today+2) but the target class is today+5, beyond
-- that period's end -- can_confirm's "covered" clause fails while its
-- "active today" clause alone would still be true, so the two direct
-- calls below isolate exactly which clause rejects the confirm attempt.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000005","role":"authenticated"}';

select throws_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
    values ((now() at time zone 'America/Lima')::date + 5, '19:00', '20:00', 'salsa', 'studio-4', 'Salsa', 'Studio 4')$$,
  '42501',
  null,
  'a member cannot confirm a class after their membership''s paid-until date'
);

reset role;

select is(
  private.can_confirm ('b0000000-0000-0000-0000-000000000005', private.lima_today ()),
  true,
  'can_confirm is true for today alone, proving member_d is genuinely active today'
);

select is(
  private.can_confirm ('b0000000-0000-0000-0000-000000000005', private.lima_today () + 5),
  false,
  'can_confirm is false for a class date beyond the member''s paid-until, even while active today'
);

-- ============================================================
-- Group 6: private.can_confirm's consent clause, isolated. member_e has a
-- paid_periods row covering today (crafted directly as postgres, bypassing
-- RLS, since paid_periods_admin_insert would itself reject recording a
-- period for an unconsented member) but no recorded consent -- proving
-- can_confirm really checks consent, not just active-today and covered.
-- ============================================================
select is(
  (select consent_at from public.profiles where id = 'b0000000-0000-0000-0000-000000000006'),
  null::timestamptz,
  'member_e is a genuinely pending account with no recorded consent'
);

select is(
  (select count(*)::int from public.paid_periods where member_id = 'b0000000-0000-0000-0000-000000000006'),
  1,
  'member_e does have a paid period covering today, so the fixture actually tests the consent clause'
);

select is(
  private.can_confirm ('b0000000-0000-0000-0000-000000000006', private.lima_today ()),
  false,
  'can_confirm is false without recorded consent, even when active today and covered'
);

-- ============================================================
-- Group 7: a member cannot read or write another member's confirmations
-- (Database Security Contract). member_b probes member_a's studio-1
-- confirmation from Group 2.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-1'),
  0,
  'a member cannot select another member''s confirmation'
);

select throws_ok(
  format(
    $$insert into public.attendance_confirmations (member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
      values (%L, (now() at time zone 'America/Lima')::date + 1, '18:00', '19:00', 'salsa', 'studio-forge', 'Salsa', 'Studio Forge')$$,
    'b0000000-0000-0000-0000-000000000002'
  ),
  '42501',
  null,
  'a member cannot insert a confirmation naming another member as member_id'
);

delete from public.attendance_confirmations where room_key = 'studio-1';

-- Checked after `reset role`, not while still impersonating member_b: a
-- count taken through member_b's own SELECT policy would read 0 whether
-- the delete succeeded or the row is merely hidden from member_b, and so
-- could never tell the two apart (member_b can never see member_a's row
-- either way). Reading it back as postgres bypasses that ambiguity.
reset role;

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-1'),
  1,
  'a member cannot delete another member''s confirmation'
);

-- ============================================================
-- Group 8: grant hygiene. There is no UPDATE grant on the table at all,
-- and starts_at can never be set by the client (no INSERT grant on that
-- column either -- it exists only so confirm_own's window check can trust
-- it).
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$update public.attendance_confirmations set class_date = class_date + 1 where room_key = 'studio-1'$$,
  '42501',
  null,
  'a member cannot update their own confirmation -- there is no UPDATE grant'
);

select throws_ok(
  $$insert into public.attendance_confirmations (class_date, start_time, end_time, genre_id, room_key, genre_name, room_label, starts_at)
    values ((now() at time zone 'America/Lima')::date + 1, '18:00', '19:00', 'salsa', 'studio-fabricate', 'Salsa', 'Studio Fabricate', now() + interval '1 day')$$,
  '42501',
  null,
  'a member cannot set starts_at directly -- there is no INSERT grant on that column'
);

-- ============================================================
-- Group 9: Cancel Attendance -- cancel before start succeeds (spec
-- scenario). Reuses member_a's still-standing studio-1 confirmation.
-- ============================================================
select lives_ok(
  $$delete from public.attendance_confirmations where room_key = 'studio-1'$$,
  'a member can cancel their own confirmation before the class starts'
);

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-1'),
  0,
  'the cancelled confirmation is removed'
);

reset role;

-- ============================================================
-- Group 10: Cancel Attendance -- cancel after start rejected (spec
-- scenario). member_f's confirmation is inserted directly as postgres,
-- bypassing RLS, with a class_date already in the past -- confirm_own's
-- own window could never produce this row, but cancel_own_before_start
-- must still reject cancelling it.
-- ============================================================
insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'b0000000-0000-0000-0000-000000000007', private.lima_today () - 2, '10:00', '11:00', 'kizomba', 'studio-started', 'Kizomba', 'Studio Started'
);

select ok(
  (select starts_at < now() from public.attendance_confirmations where room_key = 'studio-started'),
  'the fixture confirmation genuinely already started'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000007","role":"authenticated"}';

delete from public.attendance_confirmations where room_key = 'studio-started';

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-started'),
  1,
  'cancelling a confirmation after the class has started is rejected, and the row remains'
);

reset role;

-- ============================================================
-- Group 11: the admin read path (Database Security Contract): the admin
-- sees every member's confirmations; a non-admin member still sees none
-- but their own.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-started'),
  1,
  'the admin can read a confirmation belonging to any member'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'studio-started'),
  0,
  'a non-admin member still cannot read another member''s confirmation'
);

reset role;

select * from finish();

rollback;
