-- admin_get_member (Design: Interfaces, D10 route /admin/members/:memberId;
-- Spec: Member Directory). Proven against
-- supabase/migrations/20261020090000_admin_get_member.sql.
--
-- The member detail page reads ONE member through this function instead of
-- reading `profiles`: an admin can read every profile, pending and
-- unconfirmed ones included, and `profiles` holds no email at all. So the
-- function must apply the same gates as admin_search_members (an admin
-- caller, recorded consent, a confirmed email) and return the same row.
-- Group C compares the two functions over the same fixtures, so a change to
-- one that is not made to the other fails here.
--
-- Fixtures follow paid_periods.test.sql: inserted directly into `auth.users`
-- as postgres, all up front, before any `set local role` (PR2a2 gotcha: never
-- insert into auth.users after impersonating a non-superuser role in the same
-- transaction). Their periods are written relative to private.lima_today (),
-- which only works as postgres (it is granted to nobody); the assertions
-- repeat its expression, `(now() at time zone 'America/Lima')::date`, which
-- is the same value within one transaction. No SAVEPOINT/ROLLBACK TO
-- SAVEPOINT anywhere (undoes pgTAP's own test-count bookkeeping); the outer
-- `rollback;` guarantees nothing this file creates survives it.
begin;

select plan(15);

-- The admin, plus the members the lookups ask for:
--   Active Anita    a past period, the one covering today, and a future one;
--   Lapsed Luis     a period that ended before today;
--   Future Fiona    a period that starts after today;
--   Fresh Felipe    no period at all;
--   Pending Pia     email confirmed (a Google sign-in), consent NOT recorded;
--   Unconfirmed Ulises  consent recorded (an email sign-up), email NOT confirmed.
-- The last two each miss exactly one gate, so each gate is proven on its own.
-- Every member's email ends in @gm-fixture.example, so one directory search
-- finds the whole set in Group C.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-admin@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Get Admin","consent_version":"2026-01-01"}', now(), now()
);
update public.profiles set is_admin = true where id = 'e0000000-0000-0000-0000-000000000001';

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-active@gm-fixture.example', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Active Anita","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-lapsed@gm-fixture.example', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Lapsed Luis","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-future@gm-fixture.example', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Future Fiona","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-fresh@gm-fixture.example', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Fresh Felipe","consent_version":"2026-01-01"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-pending@gm-fixture.example', now(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Pending Pia"}', now(), now()
);

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'gm-unconfirmed@gm-fixture.example', null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Unconfirmed Ulises","consent_version":"2026-01-01"}', now(), now()
);

-- Anita's three periods do not overlap each other (the EXCLUDE constraint
-- would refuse them): paid_until is the latest end of ALL of them, the future
-- one included, and she is active because the middle one covers today.
insert into public.paid_periods (member_id, starts_on, ends_on, recorded_by) values
  (
    'e0000000-0000-0000-0000-000000000002',
    private.lima_today () - 400, private.lima_today () - 370,
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    private.lima_today () - 5, private.lima_today () + 30,
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    private.lima_today () + 60, private.lima_today () + 90,
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    private.lima_today () - 90, private.lima_today () - 60,
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    'e0000000-0000-0000-0000-000000000004',
    private.lima_today () + 10, private.lima_today () + 40,
    'e0000000-0000-0000-0000-000000000001'
  );

-- ============================================================
-- Group A: the contract -- its name, its exact columns, and who may execute
-- it. to_regprocedure () answers NULL for a function that does not exist, so
-- each assertion fails on its own instead of aborting the transaction.
-- ============================================================
select has_function(
  'public', 'admin_get_member', array['uuid'],
  'public.admin_get_member(uuid) exists'
);

select is(
  pg_get_function_result(to_regprocedure('public.admin_get_member(uuid)')),
  'TABLE(id uuid, full_name text, email text, paid_until date, is_active boolean)',
  'it returns exactly the columns of admin_search_members, in the same order'
);

select is(
  has_function_privilege('anon', to_regprocedure('public.admin_get_member(uuid)'), 'EXECUTE'),
  false,
  'anon has no EXECUTE on admin_get_member, whether granted directly or through PUBLIC'
);

select is(
  has_function_privilege('authenticated', to_regprocedure('public.admin_get_member(uuid)'), 'EXECUTE'),
  true,
  'authenticated has EXECUTE on admin_get_member'
);

-- ============================================================
-- Group B: only an admin gets past the door (the same 42501 as
-- admin_search_members). anon is stopped by the missing privilege, before the
-- function body runs, and the message says so: without the message, the
-- admin check inside the body would raise the same 42501 and hide a grant to
-- anon.
-- ============================================================
set local role anon;

select throws_ok(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'permission denied for function admin_get_member',
  'anon cannot call admin_get_member: it has no EXECUTE privilege'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'admin role required',
  'a member who is not an admin cannot call admin_get_member, not even for their own id'
);

-- ============================================================
-- Group C: an admin gets exactly the gated row of the member asked for -- the
-- directory's five columns, one row, nobody else's. results_eq compares the
-- column types and every row, so an extra row (the member filter lost) or a
-- missing one fails it.
-- ============================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000002')$$,
  $$values (
    'e0000000-0000-0000-0000-000000000002'::uuid,
    'Active Anita'::text,
    'gm-active@gm-fixture.example'::text,
    (now() at time zone 'America/Lima')::date + 90,
    true
  )$$,
  'a member whose periods include one that covers today is active, and paid_until is the latest end of all their periods'
);

select results_eq(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000003')$$,
  $$values (
    'e0000000-0000-0000-0000-000000000003'::uuid,
    'Lapsed Luis'::text,
    'gm-lapsed@gm-fixture.example'::text,
    (now() at time zone 'America/Lima')::date - 60,
    false
  )$$,
  'a member whose only period ended before today is inactive, with that period''s end as paid_until'
);

select results_eq(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000004')$$,
  $$values (
    'e0000000-0000-0000-0000-000000000004'::uuid,
    'Future Fiona'::text,
    'gm-future@gm-fixture.example'::text,
    (now() at time zone 'America/Lima')::date + 40,
    false
  )$$,
  'a member whose only period starts after today is inactive, with that period''s end as paid_until'
);

select results_eq(
  $$select * from public.admin_get_member('e0000000-0000-0000-0000-000000000005')$$,
  $$values (
    'e0000000-0000-0000-0000-000000000005'::uuid,
    'Fresh Felipe'::text,
    'gm-fresh@gm-fixture.example'::text,
    null::date,
    false
  )$$,
  'a member with no period still gets a row: paid_until is null and is_active is false'
);

-- Every fixture id goes through admin_get_member, and the directory is
-- searched by the domain they share. The two must agree row for row: the
-- members both show are identical, and the two members the directory hides
-- (Pia, Ulises) return nothing from admin_get_member either.
select results_eq(
  $$
    select g.*
    from unnest(array[
      'e0000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-000000000003',
      'e0000000-0000-0000-0000-000000000004',
      'e0000000-0000-0000-0000-000000000005',
      'e0000000-0000-0000-0000-000000000006',
      'e0000000-0000-0000-0000-000000000007'
    ]::uuid[]) as fixture (id)
    cross join lateral public.admin_get_member(fixture.id) as g
    order by g.id
  $$,
  $$
    select * from public.admin_search_members('@gm-fixture.example', 200) order by id
  $$,
  'for every fixture, admin_get_member returns the row admin_search_members lists, and nothing for the members it hides'
);

-- ============================================================
-- Group D: no row, and no error, for anyone who is not a listed member --
-- the same members the directory hides, and ids that belong to nobody.
-- ============================================================
select is(
  (select count(*)::int from public.admin_get_member('e0000000-0000-0000-0000-000000000006')),
  0,
  'a member who has not recorded consent gets no row, even though their email is confirmed'
);

select is(
  (select count(*)::int from public.admin_get_member('e0000000-0000-0000-0000-000000000007')),
  0,
  'a member whose email is unconfirmed gets no row, even though they recorded consent'
);

select is(
  (select count(*)::int from public.admin_get_member('e0000000-0000-0000-0000-0000000000ff')),
  0,
  'an id that belongs to nobody gets no row'
);

select is(
  (select count(*)::int from public.admin_get_member(null)),
  0,
  'a NULL id gets no row'
);

reset role;

select * from finish();

rollback;
