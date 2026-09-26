-- Account lifecycle: self-service deletion and the scheduled purges
-- (Design: D6 deletion + retention, Database Security Contract; Spec:
-- Account Deletion, Consent Before Account Creation (24h purge),
-- Attendance Retention).
--
-- Fixtures are inserted directly into `auth.users` as `postgres` (same
-- convention as attendance_confirmations.test.sql), all up front, before
-- any `set local role`, so no auth.users insert ever needs a `reset role`
-- first (Gotcha, slice 2a2). Impersonation for the two client-facing RPC
-- calls (`delete_my_account`) uses `set local role authenticated` plus
-- `set local request.jwt.claims` carrying the `sub` claim `auth.uid()`
-- reads; both can be reissued any number of times in the same
-- transaction to switch identity. Every purge function is granted to
-- nobody (Database Security Contract) and is called directly as
-- `postgres` here, the same convention `private.lima_today()` already
-- uses elsewhere -- a superuser session bypasses EXECUTE/RLS checks
-- entirely, which is exactly what lets these otherwise-unreachable
-- functions be exercised directly in a test. No SAVEPOINT/ROLLBACK TO
-- SAVEPOINT anywhere (undoes pgTAP's own test-count bookkeeping) -- the
-- outer `rollback;` guarantees nothing this file creates survives it.
--
-- "Survives" assertions for rows owned by someone else, or by a role
-- that was just denied, are always read back as `postgres` (after
-- `reset role`), never through the acting member's own filtered SELECT
-- view -- reading through that view cannot tell "deleted" apart from
-- "merely hidden from me" (pgTAP cross-member-write lesson).
begin;

select plan(33);

-- ============================================================
-- Fixtures, Group A: member_self owns one row in every table that must
-- cascade, plus an auth.sessions row (delete_my_account's cascade
-- target list: profiles, paid_periods, attendance_confirmations,
-- auth.sessions).
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-member-self@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Self","consent_version":"2026-01-01"}', now(), now()
);

insert into public.paid_periods (member_id, starts_on, ends_on) values (
  'c0000000-0000-0000-0000-000000000001', private.lima_today () - 10, private.lima_today () + 20
);

insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000001', private.lima_today () + 2, '19:00', '20:00', 'salsa', 'lifecycle-self', 'Salsa', 'Lifecycle Self'
);

insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values (
  gen_random_uuid (), 'c0000000-0000-0000-0000-000000000001', now(), now(), now()
);

-- member_bystander: an unrelated account, used to prove delete_my_account
-- never touches anyone but the caller, and as the target of the
-- "no client EXECUTE on private.delete_account" probe.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-member-bystander@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Bystander","consent_version":"2026-01-01"}', now(), now()
);

-- member_pending_declines: a PENDING Google account, used to prove
-- delete_my_account is genuinely consent-free (Design D5.3d: "Decline
-- calls delete_my_account and then signOut").
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-member-pending-declines@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Decliner"}', now(), now()
);

-- ============================================================
-- Fixtures, Group D: private.purge_pending_consent_accounts. "Pending"
-- means no recorded consent (profiles.consent_at is null) -- an email
-- sign-up always gets consent_at set in the same transaction as its
-- auth.users row (the handle_new_user trigger raises without it), so
-- only a Google fixture can genuinely be pending here.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-pending-old@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Old"}', now() - interval '24 hours', now() - interval '24 hours'
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-pending-young@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Young"}', now() - interval '1 hour', now() - interval '1 hour'
);

-- email_confirmed_at is set (not just consent_at) so this fixture is
-- never accidentally also swept by Group E's purge_unconfirmed_email_
-- accounts below -- it must survive Group D specifically because it is
-- consented, an independent reason from being email-confirmed.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-consented-not-pending@example.com', now() - interval '100 days',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Consented Not Pending","consent_version":"2026-01-01"}',
  now() - interval '100 days', now() - interval '100 days'
);

-- ============================================================
-- Fixtures, Group E: private.purge_unconfirmed_email_accounts (an
-- UNCONFIRMED owner default -- see the migration comment). Only
-- provider = 'email' accounts are in scope: google_unconfirmed_old
-- isolates that clause, since it has no email_confirmed_at either but
-- must never be touched by this function.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-unconfirmed-old@example.com', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Old","consent_version":"2026-01-01"}',
  now() - interval '8 days', now() - interval '8 days'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-unconfirmed-young@example.com', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Young","consent_version":"2026-01-01"}',
  now() - interval '1 day', now() - interval '1 day'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-confirmed-old@example.com', now() - interval '8 days',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Confirmed Old","consent_version":"2026-01-01"}',
  now() - interval '8 days', now() - interval '8 days'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-google-unconfirmed-old@example.com', null,
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Google Unconfirmed Old"}',
  now() - interval '8 days', now() - interval '8 days'
);

-- google_unconfirmed_old is consented directly (the handle_new_user
-- trigger always creates a Google row PENDING, regardless of
-- raw_user_meta_data), so this fixture is a genuinely consented,
-- genuinely email-unconfirmed account -- proving the surviving reason is
-- the provider clause, not a leftover pending state.
update public.profiles set consent_version = '2026-01-01', consent_at = now() - interval '8 days'
where id = 'c0000000-0000-0000-0000-000000000010';

select is(
  (select consent_at is not null from public.profiles where id = 'c0000000-0000-0000-0000-000000000010'),
  true,
  'google_unconfirmed_old is genuinely consented, so its survival below is explained only by provider <> email'
);

-- ============================================================
-- Fixtures, Group F: private.purge_dormant_accounts. Each fixture below
-- isolates exactly one of the five greatest() terms (created_at,
-- last_sign_in_at, max(sessions.refreshed_at), max(paid_periods.ends_on),
-- max(paid_periods.created_at)) as the sole recent signal, with every
-- other term genuinely old -- a member is "dormant" only when ALL FIVE
-- are old at once (dormant_all_old).
-- ============================================================
-- Every fixture below is a consented, EMAIL-confirmed account (email_
-- confirmed_at is old but non-null): none of them may look like an
-- unconfirmed email sign-up, or Group E's purge_unconfirmed_email_accounts
-- (which already ran above) would delete the old ones for the wrong
-- reason and contaminate this purge's own isolation.
insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-all-old@example.com', now() - interval '3 years', now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant All Old","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-recent-created@example.com', now() - interval '3 years', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Recent Created","consent_version":"2026-01-01"}',
  now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-recent-signin@example.com', now(), now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Recent Signin","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-recent-session@example.com', now() - interval '3 years', now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Recent Session","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values (
  gen_random_uuid (), 'c0000000-0000-0000-0000-000000000014', now() - interval '3 years', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-recent-period-end@example.com', now() - interval '3 years', now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Recent Period End","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);
-- The period's own created_at is pinned to the same old instant as
-- everything else here (never left at its `now()` default), so this
-- fixture isolates ends_on alone -- otherwise it would accidentally also
-- satisfy the "recent period created_at" signal tested separately below.
insert into public.paid_periods (member_id, starts_on, ends_on, created_at) values (
  'c0000000-0000-0000-0000-000000000015', private.lima_today () - 200, private.lima_today (), now() - interval '3 years'
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-recent-period-created@example.com', now() - interval '3 years', now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Recent Period Created","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);
-- Both dates of the period itself are long expired; only the row's own
-- created_at (left at its `now()` default -- an admin just touched this
-- ancient period) is recent.
insert into public.paid_periods (member_id, starts_on, ends_on) values (
  'c0000000-0000-0000-0000-000000000016', private.lima_today () - 1200, private.lima_today () - 1100
);

-- ============================================================
-- Fixtures, Group G: private.purge_expired_confirmations. One member
-- owns all three probe confirmations, at and around the 30-day boundary
-- (class_date < lima_today() - 30 is deleted; the boundary itself and a
-- future confirmation are kept).
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-member-conf-owner@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member Conf Owner","consent_version":"2026-01-01"}', now(), now()
);

insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000017', private.lima_today () - 31, '19:00', '20:00', 'salsa', 'lifecycle-old', 'Salsa', 'Lifecycle Old'
);
insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000017', private.lima_today () - 30, '19:00', '20:00', 'salsa', 'lifecycle-boundary', 'Salsa', 'Lifecycle Boundary'
);
insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000017', private.lima_today () + 3, '19:00', '20:00', 'salsa', 'lifecycle-future', 'Salsa', 'Lifecycle Future'
);

-- ============================================================
-- Group A: delete_my_account() deletes the caller's own account and
-- cascades (spec: "Self-service deletion"), and touches nobody else.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select delete_my_account()$$,
  'a signed-in member can delete their own account'
);

reset role;

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'the auth.users row is gone'
);
select is(
  (select count(*)::int from public.profiles where id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'the cascade removes the profile'
);
select is(
  (select count(*)::int from public.paid_periods where member_id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'the cascade removes the member''s paid periods'
);
select is(
  (select count(*)::int from public.attendance_confirmations where member_id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'the cascade removes the member''s attendance confirmations'
);
select is(
  (select count(*)::int from auth.sessions where user_id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'the cascade removes the member''s auth sessions'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000002'),
  1,
  'deleting one member''s account never touches another member''s account'
);

-- ============================================================
-- Group B: private.delete_account has no client EXECUTE.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select private.delete_account('c0000000-0000-0000-0000-000000000002'::uuid)$$,
  '42501',
  null,
  'a client cannot call private.delete_account directly, even on their own id'
);

reset role;

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000002'),
  1,
  'the denied direct call had no effect'
);

-- ============================================================
-- Group C: delete_my_account is consent-free (Design D5.3d: declining
-- consent deletes a still-pending account immediately, without waiting
-- for the hourly purge).
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select lives_ok(
  $$select delete_my_account()$$,
  'a pending member (no recorded consent) can still delete their own account'
);

reset role;

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000003'),
  0,
  'the pending account is gone immediately, not just after the hourly purge'
);

-- ============================================================
-- Group D: private.purge_pending_consent_accounts (spec: "Google account
-- without a recorded consent", 24-hour scenario).
-- ============================================================
select private.purge_pending_consent_accounts ();

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000004'),
  0,
  'a pending account older than 23 hours is purged'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000005'),
  1,
  'a pending account younger than 23 hours is kept'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000006'),
  1,
  'a consented account is kept regardless of age'
);

-- ============================================================
-- Group E: private.purge_unconfirmed_email_accounts (own named function,
-- an UNCONFIRMED owner default).
-- ============================================================
select private.purge_unconfirmed_email_accounts ();

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000007'),
  0,
  'an unconfirmed email account older than 7 days is purged'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000008'),
  1,
  'an unconfirmed email account younger than 7 days is kept'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000009'),
  1,
  'a confirmed email account is kept regardless of age'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000010'),
  1,
  'a non-email (Google) account is kept even with no email confirmation timestamp'
);

-- ============================================================
-- Group F: private.purge_dormant_accounts (spec: "Two years of
-- silence"). One call covers every fixture above; each "kept" fixture
-- isolates exactly one recent signal.
-- ============================================================
select private.purge_dormant_accounts ();

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000011'),
  0,
  'an account idle on every signal for 2 years is purged'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000012'),
  1,
  'a recently created account is kept even if every other signal is old'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000013'),
  1,
  'a recent sign-in keeps the account, even if every other signal is old'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000014'),
  1,
  'a recently refreshed session keeps the account, even if every other signal is old'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000015'),
  1,
  'a paid period ending recently keeps the account, even if every other signal is old'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000016'),
  1,
  'a paid period recorded recently keeps the account, even when its dates are long expired and every other signal is old'
);

-- ============================================================
-- Group G: private.purge_expired_confirmations (spec: "Attendance
-- Retention", "Old confirmation removed").
-- ============================================================
select private.purge_expired_confirmations ();

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'lifecycle-old'),
  0,
  'a confirmation for a class held 31 days ago is deleted'
);
select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'lifecycle-boundary'),
  1,
  'a confirmation exactly at the 30-day boundary is kept'
);
select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'lifecycle-future'),
  1,
  'an upcoming confirmation is never touched by the retention purge'
);

-- ============================================================
-- Group H: private.purge_expired_accounts composes the four purges
-- above. Fresh fixtures prove the composed entry point really wires up
-- both an account purge and the confirmation purge, not just that the
-- sub-functions work in isolation (Groups D-G already proved that).
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-composition-pending@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Composition Pending"}', now() - interval '24 hours', now() - interval '24 hours'
);

insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000017', private.lima_today () - 31, '19:00', '20:00', 'salsa', 'lifecycle-composition', 'Salsa', 'Lifecycle Composition'
);

select private.purge_expired_accounts ();

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000018'),
  0,
  'private.purge_expired_accounts composes the pending-consent purge'
);
select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'lifecycle-composition'),
  0,
  'private.purge_expired_accounts composes the attendance retention purge'
);

-- ============================================================
-- Group I: the pg_cron jobs are registered with the schedules the
-- design names (hourly purge, plus the weekly cron.job_run_details
-- cleanup).
-- ============================================================
select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-expired-accounts'
      and schedule = '17 * * * *'
      and active
      and command ~* 'private\.purge_expired_accounts'
  ),
  1,
  'the hourly purge_expired_accounts job is registered with the design''s schedule'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-cron-job-run-details'
      and active
      and command ~* 'cron\.job_run_details'
      -- A weekly schedule names one specific day of the week (not `*`)
      -- in the 5th cron field.
      and split_part(schedule, ' ', 5) <> '*'
  ),
  1,
  'the weekly cron.job_run_details cleanup job is registered on a specific weekday'
);

select lives_ok(
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$,
  'the weekly cleanup statement itself runs without error against the real cron.job_run_details table'
);

select * from finish();

rollback;
