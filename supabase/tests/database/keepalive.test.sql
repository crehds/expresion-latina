-- Keep-alive heartbeat (Design D7; spec: "Weekly Keep-Alive Ping",
-- "Keep-Alive Failure Detection"). Proven against
-- supabase/migrations/20260924170000_keepalive.sql.
--
-- public.keepalive() is the one function in this whole schema granted to
-- anon instead of authenticated: the daily GitHub Actions workflow
-- (.github/workflows/keepalive.yml) calls it with only the publishable
-- ("anon") key, with no signed-in session at all -- exactly what Group A
-- below exercises. now() is constant for this whole test transaction
-- (PR2a gotcha, apply-progress #228), so a changing last_ping_at value can
-- never distinguish an insert from an update here -- the row count staying
-- at exactly 1 across repeated calls is the proof instead (Group B): a
-- plain INSERT with no ON CONFLICT clause would raise 23505 on the second
-- call, since id is the primary key and always 1.
--
-- Fixtures are inserted directly into auth.users as postgres, both up
-- front, before any `set local role` (PR2a2 gotcha: never insert into
-- auth.users after impersonating a non-superuser role in the same
-- transaction). `reset role` clears only the role GUC; `request.jwt.claims`
-- keeps identifying the caller for SECURITY DEFINER calls made afterwards
-- (slice T3a2 pattern, #296). No SAVEPOINT/ROLLBACK TO SAVEPOINT anywhere
-- (undoes pgTAP's own test-count bookkeeping); the outer `rollback;`
-- guarantees nothing this file creates survives it.
begin;

select plan(20);

-- ============================================================
-- Fixtures: two consented email members, one promoted to admin. Both
-- exist only to exercise ops_heartbeat's admin-only SELECT policy --
-- keepalive() itself takes no member identity into account at all (no
-- auth.uid() anywhere in its body), which is exactly why anon, with no
-- session whatsoever, can still call it.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ka-admin@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Keepalive Admin","consent_version":"2026-01-01"}', now(), now()
);

update public.profiles set is_admin = true where id = 'd0000000-0000-0000-0000-000000000001';

insert into auth.users (
  id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ka-member@example.com',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Keepalive Member","consent_version":"2026-01-01"}', now(), now()
);

-- Snapshot of both fixtures' whole profiles rows, taken before the first
-- keepalive() call below (Group A). Group E compares this against a
-- fresh snapshot taken after every keepalive() call in this file, to
-- prove the rows are byte-for-byte unchanged -- not merely that they
-- still exist.
select set_config(
  'test.profiles_snapshot_before',
  (
    select md5(string_agg(p::text, ',' order by p.id))
    from public.profiles p
    where p.id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')
  ),
  true
);

-- ============================================================
-- Group A: public.keepalive() exists, takes no arguments, and anon (no
-- session at all -- the shape of the real GitHub Actions call) can call
-- it. The table starts empty, so the next assertions can tell "just
-- inserted" apart from "was already there".
-- ============================================================
select has_function(
  'public', 'keepalive', array[]::text[],
  'public.keepalive() exists and takes no arguments'
);

select is(
  (select count(*)::int from public.ops_heartbeat),
  0,
  'ops_heartbeat has no row before the first keepalive() call'
);

set local role anon;

select lives_ok(
  $$select public.keepalive()$$,
  'anon can call public.keepalive() with no session at all'
);

reset role;

select is(
  (select count(*)::int from public.ops_heartbeat),
  1,
  'the first call inserts exactly one row'
);
select is(
  (select id from public.ops_heartbeat),
  1,
  'the singleton row keeps id = 1'
);
select ok(
  (select last_ping_at from public.ops_heartbeat) >= now() - interval '1 minute',
  'last_ping_at is set to a recent timestamp'
);

-- ============================================================
-- Group B: later calls UPDATE the same row instead of inserting a new
-- one (the upsert proof described in the file header).
-- ============================================================
set local role anon;

select lives_ok(
  $$select public.keepalive()$$,
  'a second anon call to keepalive() succeeds (updates, does not insert)'
);
select lives_ok(
  $$select public.keepalive()$$,
  'a third anon call to keepalive() succeeds too'
);

reset role;

select is(
  (select count(*)::int from public.ops_heartbeat),
  1,
  'three calls later, ops_heartbeat still holds exactly one row'
);

-- ============================================================
-- Group C: SELECT on ops_heartbeat is admin-only. anon has no table
-- privilege at all (raises 42501, checked before RLS); a non-admin
-- member's SELECT is filtered to zero rows by RLS (no exception -- same
-- as every other RLS SELECT policy in this project); an admin's SELECT
-- returns the row.
-- ============================================================
set local role anon;

select throws_ok(
  $$select * from public.ops_heartbeat$$,
  '42501',
  null,
  'anon has no SELECT privilege on ops_heartbeat at all'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.ops_heartbeat),
  0,
  'a non-admin member''s SELECT is filtered to zero rows by RLS'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.ops_heartbeat),
  1,
  'an admin can read the heartbeat row'
);

reset role;

-- ============================================================
-- Group D: no client role -- anon, a plain member, or even an admin --
-- can INSERT/UPDATE/DELETE ops_heartbeat directly. The Database Security
-- Contract grants this table exactly one privilege (admin SELECT); every
-- write goes through keepalive(), which writes as postgres, the table's
-- owner, and so never needs (or has) a grant of its own.
-- ============================================================
set local role anon;

select throws_ok(
  $$insert into public.ops_heartbeat (id, last_ping_at) values (1, now())$$,
  '42501',
  null,
  'anon cannot INSERT into ops_heartbeat directly'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$insert into public.ops_heartbeat (id, last_ping_at) values (2, now())$$,
  '42501',
  null,
  'a non-admin member cannot INSERT into ops_heartbeat directly'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$insert into public.ops_heartbeat (id, last_ping_at) values (2, now())$$,
  '42501',
  null,
  'an admin cannot INSERT into ops_heartbeat directly either -- only keepalive() can write it'
);
select throws_ok(
  $$update public.ops_heartbeat set last_ping_at = now()$$,
  '42501',
  null,
  'an admin cannot UPDATE ops_heartbeat directly'
);
select throws_ok(
  $$delete from public.ops_heartbeat$$,
  '42501',
  null,
  'an admin cannot DELETE from ops_heartbeat directly'
);

reset role;

-- ============================================================
-- Group E: keepalive() writes nothing outside ops_heartbeat. It never
-- reads or writes profiles/paid_periods/attendance_confirmations, so the
-- two member fixtures above -- and the absence of any period or
-- confirmation for them -- must be exactly as this file left them after
-- three keepalive() calls (one in Group A, two in Group B).
-- ============================================================
select is(
  (
    select md5(string_agg(p::text, ',' order by p.id))
    from public.profiles p
    where p.id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')
  ),
  current_setting('test.profiles_snapshot_before'),
  'keepalive() leaves both profiles rows byte-for-byte unchanged, not merely still present'
);
select is(
  (
    select count(*)::int from public.paid_periods
    where member_id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')
  ),
  0,
  'keepalive() creates no paid_periods rows'
);
select is(
  (
    select count(*)::int from public.attendance_confirmations
    where member_id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')
  ),
  0,
  'keepalive() creates no attendance_confirmations rows'
);

select * from finish();

rollback;
