-- Catalog-wide privilege guard (Design: Database Security Contract, F6).
--
-- Runs unchanged in every later slice, over an explicit allowlist each
-- slice extends. At PR1a there are no tables or SECURITY DEFINER
-- functions this project owns, so checks 5-7 hold against an empty
-- allowlist by default; checks 5b and 7b fixture a real violation, assert
-- the guard's queries reject it, then drop the fixture explicitly (a
-- SAVEPOINT/ROLLBACK here would also roll back pgTAP's own bookkeeping of
-- the test that just ran, which is exactly what a live run confirmed:
-- explicit DROP does not have that problem, and the outer `rollback;`
-- below still guarantees nothing this file creates survives it).
begin;

select plan(9);

-- 1. The private schema exists at all.
select has_schema('private', 'the private schema exists');

-- 2-4. Nobody but the schema owner has USAGE on `private`. The Data API
-- never exposes it anyway (config.toml `api.schemas` lists only `public`
-- and `graphql_public`), but this is belt-and-suspenders: `private` must
-- stay unreachable even if a future config change adds it by mistake.
select is(
  has_schema_privilege('public', 'private', 'USAGE'),
  false,
  'PUBLIC has no USAGE on the private schema'
);

select is(
  has_schema_privilege('anon', 'private', 'USAGE'),
  false,
  'anon has no USAGE on the private schema'
);

select is(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  false,
  'authenticated has no USAGE on the private schema'
);

-- 5. Table/view privileges granted to anon, authenticated or PUBLIC, for
-- every table this project creates in `public` or `private`, must appear
-- in an explicit allowlist. The allowlist starts empty; each later slice
-- extends it with exactly the grants its own Database Security Contract
-- row requires.
select is(
  (
    with allowlist(schema_name, table_name, grantee, privilege) as (
      values (null::text, null::text, null::text, null::text)
      limit 0
    )
    select count(*)::int
    from information_schema.role_table_grants g
    where g.table_schema in ('public', 'private')
      and g.grantee in ('anon', 'authenticated', 'PUBLIC')
      and not exists (
        select 1 from allowlist a
        where a.schema_name = g.table_schema
          and a.table_name = g.table_name
          and a.grantee = g.grantee
          and a.privilege = g.privilege_type
      )
  ),
  0,
  'no table/view grant to anon, authenticated or PUBLIC falls outside the explicit allowlist'
);

-- 5b. Triangulation for check 5: an empty allowlist and zero violations
-- look identical unless the guard's query can actually tell a real
-- violation apart. A scratch table granting SELECT to anon is created,
-- checked, and explicitly dropped so it never survives this test.
create table public.__catalog_guard_fixture (id int);
grant select on public.__catalog_guard_fixture to anon;

select is(
  (
    with allowlist(schema_name, table_name, grantee, privilege) as (
      values (null::text, null::text, null::text, null::text)
      limit 0
    )
    select count(*)::int
    from information_schema.role_table_grants g
    where g.table_schema in ('public', 'private')
      and g.grantee in ('anon', 'authenticated', 'PUBLIC')
      and not exists (
        select 1 from allowlist a
        where a.schema_name = g.table_schema
          and a.table_name = g.table_name
          and a.grantee = g.grantee
          and a.privilege = g.privilege_type
      )
  ) > 0,
  true,
  'the guard flags a table grant to anon that is outside the allowlist'
);

drop table public.__catalog_guard_fixture;

-- 6. EXECUTE privileges on functions in `public` or `private`, held by
-- anon or authenticated, must appear in the same kind of explicit
-- allowlist. PUBLIC is covered implicitly: an EXECUTE grant to PUBLIC
-- makes has_function_privilege true for every non-superuser role,
-- including anon and authenticated, so it is caught here too.
-- Triangulation skipped: this is the same allowlist-membership shape as
-- check 5, already proven above against a real violation; no function
-- exists yet to fixture one without adding scope beyond this slice.
select is(
  (
    with allowlist(schema_name, function_name, grantee) as (
      values (null::text, null::text, null::text)
      limit 0
    )
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) as roles(rolename)
    where n.nspname in ('public', 'private')
      and has_function_privilege(roles.rolename, p.oid, 'EXECUTE')
      and not exists (
        select 1 from allowlist a
        where a.schema_name = n.nspname
          and a.function_name = p.proname
          and a.grantee = roles.rolename
      )
  ),
  0,
  'no function EXECUTE grant to anon or authenticated falls outside the explicit allowlist'
);

-- 7. Every SECURITY DEFINER function in `public` or `private` must be
-- owned by postgres and pin search_path to empty, so a caller-controlled
-- search_path can never redirect an unqualified name inside it to an
-- attacker's object (Design F3).
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles o on o.oid = p.proowner
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and (
        o.rolname <> 'postgres'
        or not exists (
          select 1
          from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
          where cfg = 'search_path='
        )
      )
  ),
  0,
  'every SECURITY DEFINER function in public/private is owned by postgres and pins search_path to empty'
);

-- 7b. Triangulation for check 7: create a SECURITY DEFINER function that
-- intentionally omits `set search_path = ''`, prove the guard's own
-- ownership/search_path scan flags it, then explicitly drop it.
create function private.__catalog_guard_bad_definer()
returns void
language plpgsql
security definer
as $fn$
begin
end;
$fn$;

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles o on o.oid = p.proowner
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and (
        o.rolname <> 'postgres'
        or not exists (
          select 1
          from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
          where cfg = 'search_path='
        )
      )
  ) > 0,
  true,
  'the guard flags a SECURITY DEFINER function that does not pin search_path to empty'
);

drop function private.__catalog_guard_bad_definer();

select * from finish();

rollback;
