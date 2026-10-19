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

select plan(55);

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

-- V (review advisory): just-inside / just-outside the exact 23-hour
-- threshold, pinned relative to the SAME expression the migration
-- itself subtracts (`now() - interval '23 hours'`), one minute to
-- either side -- not the coarse 24h/1h fixtures above. now() is
-- constant for the whole transaction, so both hold regardless of when
-- the suite runs.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-pending-justinside@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Just Inside"}',
  now() - interval '23 hours' + interval '1 minute', now() - interval '23 hours' + interval '1 minute'
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-pending-justoutside@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Just Outside"}',
  now() - interval '23 hours' - interval '1 minute', now() - interval '23 hours' - interval '1 minute'
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

-- V (review advisory): just-inside / just-outside the exact 7-day
-- threshold, pinned relative to `now() - interval '7 days'`, the same
-- expression the migration subtracts.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-unconfirmed-justinside@example.com', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Just Inside","consent_version":"2026-01-01"}',
  now() - interval '7 days' + interval '1 minute', now() - interval '7 days' + interval '1 minute'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-unconfirmed-justoutside@example.com', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Just Outside","consent_version":"2026-01-01"}',
  now() - interval '7 days' - interval '1 minute', now() - interval '7 days' - interval '1 minute'
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

-- V (review advisory): just-inside / just-outside the exact 2-year
-- threshold, pinned relative to `now() - interval '2 years'` (the same
-- expression the migration subtracts), 1 hour to either side. Every
-- signal on both fixtures is pinned to the SAME age, so greatest()
-- genuinely reflects that one boundary instead of a mix of signals.
insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-justinside@example.com',
  now() - interval '2 years' + interval '1 hour', now() - interval '2 years' + interval '1 hour',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Just Inside","consent_version":"2026-01-01"}',
  now() - interval '2 years' + interval '1 hour', now() - interval '2 years' + interval '1 hour'
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-dormant-justoutside@example.com',
  now() - interval '2 years' - interval '1 hour', now() - interval '2 years' - interval '1 hour',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dormant Just Outside","consent_version":"2026-01-01"}',
  now() - interval '2 years' - interval '1 hour', now() - interval '2 years' - interval '1 hour'
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
-- Group A0: delete_my_account requires an authenticated caller (owner
-- decision 2026-09-26, review advisory U). Called here as
-- `authenticated`, with no JWT claims ever set in this transaction, so
-- auth.uid() reads null -- the same failure mode as a malformed or
-- missing bearer token reaching PostgREST. This MUST run before any
-- other group sets request.jwt.claims (set local persists for the rest
-- of the transaction, and no later group resets it back to unset).
-- ============================================================
set local role authenticated;

select throws_ok(
  $$select delete_my_account()$$,
  '42501',
  null,
  'delete_my_account raises when there is no authenticated caller (auth.uid() is null)'
);

reset role;

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

-- delete_my_account raises when the account was already deleted (owner
-- decision 2026-09-26, review advisory U). auth.uid() here is a real,
-- well-formed id -- the very one that just deleted itself above -- so
-- this isolates the "nothing was deleted" branch from the "no caller at
-- all" branch Group A0 already proved.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select delete_my_account()$$,
  'P0002',
  null,
  'delete_my_account raises when the caller''s account was already deleted'
);

reset role;

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
select is(
  private.purge_pending_consent_accounts (),
  2,
  'purge_pending_consent_accounts reports deleting exactly the two accounts this group''s fixtures make eligible'
);

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
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000019'),
  1,
  'a pending account 1 minute inside the 23-hour threshold is kept'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000020'),
  0,
  'a pending account 1 minute past the 23-hour threshold is purged'
);

-- ============================================================
-- Group E: private.purge_unconfirmed_email_accounts (own named function,
-- an UNCONFIRMED owner default).
-- ============================================================
select is(
  private.purge_unconfirmed_email_accounts (),
  2,
  'purge_unconfirmed_email_accounts reports deleting exactly the two accounts this group''s fixtures make eligible'
);

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
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000021'),
  1,
  'an unconfirmed email account 1 minute inside the 7-day threshold is kept'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000022'),
  0,
  'an unconfirmed email account 1 minute past the 7-day threshold is purged'
);

-- ============================================================
-- Group F: private.purge_dormant_accounts (spec: "Two years of
-- silence"). One call covers every fixture above; each "kept" fixture
-- isolates exactly one recent signal.
-- ============================================================
select is(
  private.purge_dormant_accounts (),
  2,
  'purge_dormant_accounts reports deleting exactly the two accounts this group''s fixtures make eligible'
);

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
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000023'),
  1,
  'an account 1 hour inside the 2-year dormant threshold on every signal is kept'
);
select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000024'),
  0,
  'an account 1 hour past the 2-year dormant threshold on every signal is purged'
);

-- ============================================================
-- Group G: private.purge_expired_confirmations (spec: "Attendance
-- Retention", "Old confirmation removed").
-- ============================================================
select is(
  private.purge_expired_confirmations (),
  1,
  'purge_expired_confirmations reports deleting exactly the one confirmation past the 30-day retention window'
);

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

-- Group H (composed-entry-point test) removed: private.purge_expired_accounts()
-- no longer exists (review advisory Y2 -- see the migration's own comment
-- on the four cron.schedule calls below the purge functions). There is no
-- single entry point left to test composing; Groups D-G above already
-- prove each purge function works on its own, and Group I below proves
-- each one has its own pg_cron job.

-- ============================================================
-- Group J: each purge job's own scheduled command is a single, bare call
-- with nothing to swallow a failure (owner decision 2026-09-26, review
-- advisory Y2). private.purge_expired_accounts() -- the composed entry
-- point advisories Q/R/T once had isolate each purge with its own
-- BEGIN/EXCEPTION block -- is gone; every command below is the EXACT
-- text now registered as one purge's pg_cron job (see Group I). pg_cron's
-- own scheduler runs outside any test transaction (it wakes on
-- wall-clock time and each run opens its own session), so this file
-- cannot literally watch a job fire and check cron.job_run_details for
-- it -- the closest equivalent provable here is that the very call each
-- job makes, run exactly as written, throws instead of being caught, and
-- that a second, unrelated call made right after it still succeeds on
-- its own -- i.e. these are independent statements, not steps sharing
-- one exception handler. A temporary trigger, local to this test file
-- only, simulates the pending-consent purge failing on its one target
-- row.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-iso-blocked-pending@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Iso Blocked Pending"}', now() - interval '25 hours', now() - interval '25 hours'
);

insert into auth.users (
  id, instance_id, aud, role, email, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-iso-dormant@example.com', now() - interval '3 years', now() - interval '3 years',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Iso Dormant","consent_version":"2026-01-01"}',
  now() - interval '3 years', now() - interval '3 years'
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'al-iso-confirmation-owner@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Iso Confirmation Owner","consent_version":"2026-01-01"}', now(), now()
);

insert into public.attendance_confirmations (
  member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) values (
  'c0000000-0000-0000-0000-000000000027', private.lima_today () - 31, '19:00', '20:00', 'salsa', 'lifecycle-isolation', 'Salsa', 'Lifecycle Isolation'
);

-- Blocks the delete for exactly one row (matched by email, not id, so
-- the trigger body never needs to know any fixture's uuid), simulating
-- the pending-consent purge hitting an unexpected failure -- a future
-- FK or constraint this migration does not currently have, standing in
-- for one this test cannot otherwise provoke. This whole file runs in
-- one transaction that always ends in `rollback;`, so the trigger and
-- function would disappear either way, but both are dropped explicitly
-- right after use, the same hygiene catalog_privileges.test.sql already
-- uses for its own fixture functions.
create function pg_temp.__block_one_delete()
returns trigger
language plpgsql
as $$
begin
  if old.email = 'al-iso-blocked-pending@example.com' then
    raise exception 'simulated failure for the purge isolation test';
  end if;
  return old;
end;
$$;

create trigger __block_one_delete_trigger
before delete on auth.users
for each row
execute function pg_temp.__block_one_delete();

select throws_ok(
  $$select private.purge_pending_consent_accounts()$$,
  'P0001',
  'simulated failure for the purge isolation test',
  'the pending-consent purge''s own job command -- a bare, unwrapped call -- throws instead of swallowing the failure'
);

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000025'),
  1,
  'the row the trigger blocked is still there -- the failed purge genuinely did not commit its delete'
);

select lives_ok(
  $$select private.purge_dormant_accounts()$$,
  'the dormant purge''s own job command still succeeds when called right after the pending-consent purge threw'
);

select is(
  (select count(*)::int from auth.users where id = 'c0000000-0000-0000-0000-000000000026'),
  0,
  'the dormant purge deleted its own unrelated target -- unaffected by the pending-consent purge''s failure'
);

select lives_ok(
  $$select private.purge_expired_confirmations()$$,
  'the attendance-retention purge''s own job command also still succeeds, called right after the same failure'
);

select is(
  (select count(*)::int from public.attendance_confirmations where room_key = 'lifecycle-isolation'),
  0,
  'attendance retention still ran after the pending-consent purge failed'
);

drop trigger __block_one_delete_trigger on auth.users;
drop function pg_temp.__block_one_delete();

-- ============================================================
-- Group I: the pg_cron jobs are registered with the schedules the
-- design names -- one job per purge (review advisory Y2), plus the
-- weekly cron.job_run_details cleanup. Every purge job's check also
-- asserts its command mentions NO other purge function, so a future
-- edit could not silently recompose two jobs into one shared call
-- without failing here.
-- ============================================================
select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-pending-consent-accounts'
      and schedule = '17 * * * *'
      and active
      and command ~* 'private\.purge_pending_consent_accounts'
      and command !~* 'purge_unconfirmed_email_accounts|purge_dormant_accounts|purge_expired_confirmations|purge_expired_accounts'
  ),
  1,
  'the pending-consent purge has its own job, on its own schedule, calling only itself'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-unconfirmed-email-accounts'
      and schedule = '22 * * * *'
      and active
      and command ~* 'private\.purge_unconfirmed_email_accounts'
      and command !~* 'purge_pending_consent_accounts|purge_dormant_accounts|purge_expired_confirmations|purge_expired_accounts'
  ),
  1,
  'the unconfirmed-email purge has its own job, on its own schedule, calling only itself'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-dormant-accounts'
      and schedule = '27 * * * *'
      and active
      and command ~* 'private\.purge_dormant_accounts'
      and command !~* 'purge_pending_consent_accounts|purge_unconfirmed_email_accounts|purge_expired_confirmations|purge_expired_accounts'
  ),
  1,
  'the dormant purge has its own job, on its own schedule, calling only itself'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-expired-confirmations'
      and schedule = '32 * * * *'
      and active
      and command ~* 'private\.purge_expired_confirmations'
      and command !~* 'purge_pending_consent_accounts|purge_unconfirmed_email_accounts|purge_dormant_accounts|purge_expired_accounts'
  ),
  1,
  'the attendance-retention purge has its own job, on its own schedule, calling only itself'
);

select is(
  (select count(*)::int from cron.job where command ~* 'purge_expired_accounts'),
  0,
  'no job calls purge_expired_accounts -- the old composed hourly job (and the function it called) is gone'
);

select is(
  (
    select count(distinct schedule)::int from cron.job
    where jobname in (
      'purge-pending-consent-accounts',
      'purge-unconfirmed-email-accounts',
      'purge-dormant-accounts',
      'purge-expired-confirmations'
    )
  ),
  4,
  'the four purge jobs run at four distinct minutes, never at the same moment'
);

-- W (review advisory): assert the weekly job's schedule and retention
-- interval exactly, not just "some weekday" and "some interval".
select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-cron-job-run-details'
      and schedule = '0 4 * * 0'
      and active
      and command ~* 'cron\.job_run_details'
  ),
  1,
  'the weekly cron.job_run_details cleanup job is registered with the design''s exact schedule (Sunday 04:00 UTC)'
);

select is(
  (
    select count(*)::int from cron.job
    where jobname = 'purge-cron-job-run-details'
      and command ~* 'interval\s+''7 days'''
  ),
  1,
  'the weekly cleanup job retains cron.job_run_details rows for exactly 7 days -- long enough for a failed purge run to be noticed'
);

select lives_ok(
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$,
  'the weekly cleanup statement itself runs without error against the real cron.job_run_details table'
);

select * from finish();

rollback;
