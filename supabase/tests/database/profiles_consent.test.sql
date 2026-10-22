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

select plan(51);

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

-- PR1b review follow-up (whole-branch review): the full_name bounds
-- (1-120 chars after trimming, private.full_name_max_length()) are
-- enforced on email sign-up too, not just the table CHECK.
select throws_ok(
  $$insert into auth.users (
      id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'blank-name@example.com', '{"provider":"email","providers":["email"]}',
      '{"full_name":"   ","consent_version":"2026-01-01"}', now(), now()
    )$$,
  '22023',
  null,
  'email sign-up with a full_name that is blank after trimming is rejected'
);

select throws_ok(
  $$insert into auth.users (
      id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'long-name@example.com', '{"provider":"email","providers":["email"]}',
      ('{"full_name":"' || repeat('x', 121) || '","consent_version":"2026-01-01"}')::jsonb, now(), now()
    )$$,
  '22023',
  null,
  'email sign-up with a full_name over 120 characters is rejected'
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
  (select consent_at = now() from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'record_consent stamps consent_at with the server clock'
);
select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Member B',
  'record_consent fills the name in from the sign-up metadata the first time'
);

-- A DIFFERENT value than what record_consent already copied in, so a
-- blocked UPDATE (bug) would leave the old value and fail this assertion
-- instead of passing vacuously (PR1b review follow-up, Finding 1).
update public.profiles
set
  full_name = 'Member B Updated'
where
  id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Member B Updated',
  'updating full_name succeeds once consent is recorded'
);

-- Blank-after-trim is rejected on self-update too: sign-up already
-- enforces the same 1-character floor via handle_new_user, but nothing
-- previously stopped a consented member from blanking their own name
-- here. The table CHECK stays untouched on purpose -- a pending Google
-- profile legitimately holds '', and record_consent keeps '' when
-- Google's own metadata has no name, so a table-level floor would break
-- consent.
select throws_ok(
  $$update public.profiles set full_name = '   ' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'a consented member cannot blank their own full_name on self-update'
);

select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Member B Updated',
  'the rejected blank-name update leaves full_name unchanged'
);

-- PR1b review follow-up (Finding 2): the column-scoped grant
-- (`grant update (full_name) ... to authenticated`) is the only UPDATE
-- privilege a member has on their own row -- is_admin, consent_version
-- and consent_at all raise insufficient_privilege before RLS even runs.
select throws_ok(
  $$update public.profiles set is_admin = true where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'a consented member cannot update is_admin on their own row'
);
select throws_ok(
  $$update public.profiles set consent_version = '2026-01-01' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'a consented member cannot update consent_version on their own row'
);
select throws_ok(
  $$update public.profiles set consent_at = now() where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  null,
  'a consented member cannot update consent_at on their own row'
);

reset role;

-- record_consent fills the name in from the sign-up metadata the first time
-- (profile still pending): `full_name` first, which member B above covers,
-- then Google's `name` for an account that only has that one, trimmed; and
-- it cuts a name over the limit instead of letting the table CHECK reject it
-- (20260924130000_profiles_and_consent.sql: the select of the metadata, and
-- the `left(...)` in the update).
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'google-name-only@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"name":"  Google Name  "}', now(), now()
);
-- The limit's worth of 'a' and then ten 'b': what is left of the name shows
-- which end of it survives the cut.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'google-long-name@example.com',
  '{"provider":"google","providers":["google"]}',
  ('{"full_name":"' || repeat('a', private.full_name_max_length ()) || repeat('b', 10) || '"}')::jsonb,
  now(), now()
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$select public.record_consent('2026-01-01')$$,
  'a pending account whose metadata has only a name can record consent'
);

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  $$select public.record_consent('2026-01-01')$$,
  'a pending account whose name is over the limit can record consent'
);

reset role;

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Google Name',
  'record_consent falls back to the trimmed name metadata when there is no full_name'
);
select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  repeat('a', private.full_name_max_length ()),
  'record_consent keeps the first characters of a name over the limit'
);

-- The metadata may have no name at all. A pending profile holds '' then, and
-- keeping '' is what the update does with or without its guard against an empty
-- name, so that case shows nothing. The guard shows on a pending profile that
-- already holds a name (one named by hand before the member ever consented, say):
-- an empty name in the metadata must not blank it.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'google-no-name@example.com',
  '{"provider":"google","providers":["google"]}',
  '{}', now(), now()
);
update public.profiles set full_name = 'Already Named' where id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select lives_ok(
  $$select public.record_consent('2026-01-01')$$,
  'a pending account whose metadata has no name can record consent'
);

reset role;

select is(
  (select full_name from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'Already Named',
  'record_consent keeps the stored name when the metadata has none'
);
select is(
  private.has_consent('33333333-3333-3333-3333-333333333333'),
  true,
  'the consent of a pending account whose metadata has no name is recorded'
);

-- PR1b review follow-up (Finding 3): record_consent must not silently
-- succeed when it has no profile row to update -- e.g. an auth user
-- created before this migration existed. Simulate that by deleting the
-- profile a normal sign-up just created, then calling record_consent as
-- that user.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'member-e@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Member E","consent_version":"2026-01-01"}', now(), now()
);

delete from public.profiles where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

set local role authenticated;
set local request.jwt.claims to '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';

select throws_ok(
  $$select public.record_consent('2026-01-01')$$,
  'P0002',
  null,
  'record_consent raises when the caller has no profile row'
);

reset role;

-- PR1b review follow-up (Finding 4a): admin branch of profiles_select
-- (Design Database Security Contract, F2). private.is_admin() requires a
-- recorded consent, so an admin flag alone is not enough.
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pending-admin@example.com',
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Admin"}', now(), now()
);
update public.profiles set is_admin = true where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

set local role authenticated;
set local request.jwt.claims to '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id <> 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  0,
  'an admin without recorded consent cannot see other members'' rows'
);

reset role;

update public.profiles set is_admin = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'a consented admin can see another member''s profile row'
);

reset role;

update public.profiles set is_admin = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- PR1b review follow-up (Finding 4b): re-consent (Design D5.6) updates
-- consent_version and consent_at, and keeps the full_name the member
-- already has -- record_consent only fills the name in from auth.users
-- the first time (profile still pending).
insert into public.privacy_notice_versions (version) values ('2026-06-01');

-- Member C signed up in this same transaction, and now() does not move inside
-- one, so C's consent_at already equals now(): a record_consent that never
-- stamped it again would still pass the check below. Put it far in the past
-- first (as postgres: a member has no UPDATE on that column), so that only the
-- re-consent can bring it back to now().
--
-- The name has the same problem: the sign-up metadata of C says 'Member C', and
-- so does its profile, so a record_consent that wrote the metadata over the
-- stored name on a re-consent would change nothing the check below could see. C
-- gets another name, as if it had renamed itself since signing up, so that only
-- a record_consent that leaves the stored name alone passes.
update public.profiles
set
  consent_at = '2020-01-01 00:00:00+00',
  full_name = 'Member C Renamed'
where
  id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select ok(
  (select consent_at < now() from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'member C starts the re-consent with a consent_at in the past'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

select lives_ok(
  $$select public.record_consent('2026-06-01')$$,
  're-consenting to a newer notice version succeeds'
);
select is(
  (select consent_version from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '2026-06-01',
  're-consent updates consent_version to the newer notice version'
);
select ok(
  (select consent_at = now() from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  're-consent stamps consent_at again with the server clock'
);
select is(
  (select full_name from public.profiles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'Member C Renamed',
  're-consent does not overwrite an already-set full_name'
);

reset role;

-- Bugfix regression: the full_name CHECK used to call a function, and
-- Postgres checks EXECUTE on that function for whichever role performs
-- the INSERT/UPDATE. service_role keeps Supabase's default table privileges
-- on profiles (this migration only revokes from public, anon,
-- authenticated) and bypasses RLS, so before the fix ANY write to
-- profiles as service_role failed with 42501 (permission denied for
-- function full_name_max_length), even one that never touches full_name.
set local role service_role;

select lives_ok(
  $$update public.profiles set is_admin = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'service_role can update a profile row'
);

select is(
  (select is_admin from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  true,
  'service_role''s update actually changed the row'
);

-- The INSERT path has its own privileges to lose. Member E lost its profile
-- in the "no profile row" scenario above and nothing has created one since,
-- so service_role can insert it.
select lives_ok(
  $$insert into public.profiles (id, full_name) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Member E')$$,
  'service_role can insert a profile row'
);

reset role;

-- Drift guard: the table CHECK hardcodes the length limit as a literal
-- (a function call in a CHECK needs EXECUTE for every writing role,
-- which is what the bug above was), while handle_new_user and
-- record_consent keep calling private.full_name_max_length(). This
-- proves the literal still matches the function's value instead of the
-- two silently drifting apart. Runs as postgres (the owner role, which
-- the CHECK is evaluated for here too): the boundary value is built
-- while still postgres because service_role/authenticated have no
-- EXECUTE on the function.
select lives_ok(
  format(
    $$update public.profiles set full_name = %L where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
    repeat('x', private.full_name_max_length ())
  ),
  'a full_name at the maximum length is accepted'
);

select is(
  (select char_length(full_name) from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  private.full_name_max_length (),
  'the stored full_name is exactly the maximum length'
);

select throws_ok(
  format(
    $$update public.profiles set full_name = %L where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
    repeat('x', private.full_name_max_length () + 1)
  ),
  '23514',
  null,
  'a full_name one character over the maximum length is rejected'
);

select * from finish();

rollback;
