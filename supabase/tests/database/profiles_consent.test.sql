-- Profiles + consent (Design: D5 consent sequence, Database Security
-- Contract; Spec: Consent Before Account Creation, Consent Record, Account
-- Registration, Data Protection).
--
-- Auth users are inserted directly as `postgres` (the role migrations and
-- this test run as), matching how GoTrue itself writes `auth.users`: the
-- app never gets to do this from the browser, and `private.handle_new_user`
-- runs the same way regardless of who performed the insert. Impersonation
-- for RLS scenarios uses `set local role authenticated` plus
-- `set local request.jwt.claims` carrying the `sub` claim `auth.uid()`
-- reads. No SAVEPOINT/ROLLBACK TO SAVEPOINT is used anywhere in this file
-- (Gotcha, PR1a: it undoes pgTAP's own test-count bookkeeping) --
-- `throws_ok` catches its own exceptions internally without one, and
-- `set local` (unlike SAVEPOINT) can be re-issued as many times as needed
-- in the same transaction to switch identity between scenarios.
begin;

select plan(22);

-- The version the migration seeds (Design D5.1: "A migration seeds
-- privacy_notice_versions, no personal data").
-- Member A signs up by email with consent given at sign-up; member B
-- signs up through Google, so its profile starts PENDING.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'member-a@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"  Ana Lopez  ","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'member-b@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Member B"}', now(), now()
);

-- Google sign-up creates a PENDING profile: no consent, no name yet
-- (Design D5.3b; Spec "Google account without a recorded consent").
select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '',
  'a Google sign-up starts with an empty full_name'
);
select ok(
  (select consent_at is null from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'a Google sign-up starts with no recorded consent'
);

-- Form sign-up with consent creates the account and its consent together
-- (Design D5.2; Spec "Consent Record").
select is(
  (select full_name from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Ana Lopez',
  'email sign-up trims full_name from the metadata'
);
select is(
  (select consent_version from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  '2026-01-01',
  'email sign-up records the accepted notice version'
);
select ok(
  (select consent_at is not null from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'email sign-up records consent_at immediately'
);

-- Email sign-up without a consent_version raises (Spec "Consent not
-- given"; a client that bypasses the UI still cannot create an account).
select throws_ok(
  $$insert into auth.users (
      id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'no-version@example.com', '{"provider":"email","providers":["email"]}',
      '{"full_name":"No Version"}', now(), now()
    )$$,
  '22023',
  null,
  'email sign-up without a consent_version is rejected'
);

-- Email sign-up with an unknown version raises.
select throws_ok(
  $$insert into auth.users (
      id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bad-version@example.com', '{"provider":"email","providers":["email"]}',
      '{"full_name":"Bad Version","consent_version":"9999-01-01"}', now(), now()
    )$$,
  '22023',
  null,
  'email sign-up with an unknown consent version is rejected'
);

-- An unknown provider raises (fail closed -- Design D5.4).
select throws_ok(
  $$insert into auth.users (
      id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'facebook@example.com', '{"provider":"facebook","providers":["facebook"]}',
      '{}', now(), now()
    )$$,
  '22023',
  null,
  'sign-up through an unrecognized provider is rejected'
);

-- private.has_consent() reads member B's still-pending state directly
-- (explicit uuid argument, no impersonation needed).
select is(
  private.has_consent('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  false,
  'has_consent is false before record_consent runs'
);

-- private.handle_new_user keeps working with EXECUTE revoked from every
-- client role (Design F3; every sign-up above already ran under the
-- revoke baked into the migration -- this asserts the revoke itself, and
-- that a further sign-up still succeeds under it).
select is(
  has_function_privilege('anon', 'private.handle_new_user()', 'EXECUTE'),
  false,
  'anon has no EXECUTE on private.handle_new_user'
);
select is(
  has_function_privilege('authenticated', 'private.handle_new_user()', 'EXECUTE'),
  false,
  'authenticated has no EXECUTE on private.handle_new_user'
);

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'member-c@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member C","consent_version":"2026-01-01"}', now(), now()
);
select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'sign-up still creates a profile after EXECUTE is revoked on handle_new_user'
);

-- RLS: a member reads their own row and never another member's.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'a member can select their own profile row'
);
select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'a member cannot select another member''s profile row'
);

reset role;

-- RLS: member B (still pending) cannot update full_name, has no INSERT or
-- DELETE, then record_consent flips has_consent and unblocks the update.
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

-- A data-modifying CTE must be the top-level statement, so the UPDATE runs
-- on its own line; the assertion checks its effect (or lack of one)
-- afterward instead of counting RETURNING rows inline.
update public.profiles
set
  full_name = 'Should Not Apply'
where
  id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '',
  'updating full_name is blocked before consent is recorded'
);

select throws_ok(
  $$insert into public.profiles (id, full_name) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'x')$$,
  '42501',
  null,
  'clients have no INSERT on profiles'
);
select throws_ok(
  $$delete from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'clients have no DELETE on profiles'
);

select throws_ok(
  $$select public.record_consent('9999-01-01')$$,
  '22023',
  null,
  'record_consent rejects an unknown version'
);

select lives_ok(
  $$select public.record_consent('2026-01-01')$$,
  'record_consent accepts the current version'
);

select is(
  private.has_consent('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  true,
  'has_consent turns true once record_consent has run'
);
select ok(
  (select now() - consent_at < interval '10 seconds' from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'record_consent stamps consent_at with the server clock'
);

update public.profiles
set
  full_name = 'Member B'
where
  id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Member B',
  'updating full_name succeeds once consent is recorded'
);

reset role;

select * from finish();

rollback;
