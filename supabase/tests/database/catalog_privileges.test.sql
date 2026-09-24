-- Catalog-wide privilege guard (Design: Database Security Contract, F6).
--
-- Runs unchanged in every later slice, over an explicit allowlist each
-- slice extends. At PR1a there are no tables and no SECURITY DEFINER
-- functions this project owns, so checks 5-7 hold against an empty
-- allowlist by default (check 7 enforces a fixed rule -- owner `postgres`,
-- `search_path` pinned empty -- and carries no allowlist of its own).
-- Checks 5b, 7-pos and 7b fixture a real case each, assert the guard's
-- own queries classify it correctly, then drop the fixture explicitly (a
-- SAVEPOINT/ROLLBACK here would also roll back pgTAP's own bookkeeping of
-- the test that just ran, which is exactly what a live run confirmed:
-- explicit DROP does not have that problem, and the outer `rollback;`
-- below still guarantees nothing this file creates survives it).
begin;

select plan(10);

-- Shared guard queries, defined ONCE and reused by both the real checks
-- and their fixture checks below, so the two can never drift apart. Both
-- read ACLs from the catalogs (pg_class.relacl / pg_proc.proacl via
-- aclexplode) instead of information_schema, which only lists grants
-- involving roles enabled for the current session and can miss grants
-- made by other grantors. aclexplode's grantee 0 is the PUBLIC pseudo-role.
-- Objects owned by an extension (pg_depend deptype = 'e') are excluded:
-- this project's own tables/functions are what the guard polices, not
-- whatever a future extension installs into these schemas.
create function pg_temp.__catalog_table_grants()
returns table (schema_name text, table_name text, grantee text, privilege text)
language sql
stable
as $fn$
  select n.nspname::text, c.relname::text,
         case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
         a.privilege_type::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) as a
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'v', 'm', 'p', 'f')
    and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
    and not exists (
      select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e'
    )
$fn$;

-- SECURITY DEFINER functions must be owned by `postgres` and pin
-- search_path to empty (Design F3), so a caller-controlled search_path
-- can never redirect an unqualified name inside them to an attacker's
-- object. Postgres stores `set search_path = ''` as the proconfig entry
-- `search_path=""` (search_path is a GUC_LIST_QUOTE setting, quoted even
-- when the list is empty) -- verified against this local database, and
-- asserted on below by the "correctly pinned" fixture.
create function pg_temp.__catalog_definer_violations()
returns table (schema_name text, function_name text)
language sql
stable
as $fn$
  select n.nspname::text, p.proname::text
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
        where cfg = 'search_path=""'
      )
    )
$fn$;

-- 1. The private schema exists at all.
select has_schema('private', 'the private schema exists');

-- 2-4. `private` stays unreachable through the Data API regardless
-- (config.toml `api.schemas` lists only `public` and `graphql_public`),
-- but PUBLIC and anon must never gain USAGE even if a future config
-- change adds `private` to the exposed schemas by mistake. `authenticated`
-- is the one explicit, allowlisted exception (from PR1b onward): the RLS
-- policies on `public.profiles` call `private.is_admin()` and
-- `private.has_consent()` as the invoking role, which needs USAGE on the
-- schema to resolve those calls at all -- the functions themselves stay
-- unreachable on their own, since EXECUTE is granted only per function
-- (check 6), never at the schema level.
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
  true,
  'authenticated has USAGE on the private schema (needed to call the RLS policy helpers)'
);

-- 5. Table/view privileges granted to anon, authenticated or PUBLIC, for
-- every table this project creates in `public` or `private`, must appear
-- in an explicit allowlist. Each slice extends it with exactly the grants
-- its own Database Security Contract row requires. `profiles` UPDATE is
-- column-scoped (`full_name` only, PR1b) and never appears here: column
-- grants live in pg_attribute.attacl, which this table-level ACL scan
-- does not read -- only the table-wide SELECT grant shows up.
select is(
  (
    with allowlist(schema_name, table_name, grantee, privilege) as (
      values ('public', 'profiles', 'authenticated', 'SELECT')
    )
    select count(*)::int
    from pg_temp.__catalog_table_grants() g
    where not exists (
      select 1 from allowlist a
      where a.schema_name = g.schema_name
        and a.table_name = g.table_name
        and a.grantee = g.grantee
        and a.privilege = g.privilege
    )
  ),
  0,
  'no table/view grant to anon, authenticated or PUBLIC falls outside the explicit allowlist'
);

-- 5b. Triangulation for check 5: an empty allowlist and zero violations
-- look identical unless the guard's own query can actually tell a real
-- violation apart. A scratch table is created and checked; Supabase's
-- default privileges already grant anon/authenticated on any new `public`
-- table, so the explicit `grant select ... to anon` below only documents
-- intent -- the table would be flagged either way. The assertion is
-- filtered to this fixture's own name, so it proves what its label says
-- instead of also passing on some unrelated violation.
create table public.__catalog_guard_fixture (id int);
grant select on public.__catalog_guard_fixture to anon;

select is(
  (
    with allowlist(schema_name, table_name, grantee, privilege) as (
      values (null::text, null::text, null::text, null::text)
      limit 0
    )
    select count(*)::int
    from pg_temp.__catalog_table_grants() g
    where g.table_name = '__catalog_guard_fixture'
      and not exists (
        select 1 from allowlist a
        where a.schema_name = g.schema_name
          and a.table_name = g.table_name
          and a.grantee = g.grantee
          and a.privilege = g.privilege
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
      values
        ('public', 'record_consent', 'authenticated'),
        ('private', 'is_admin', 'authenticated'),
        ('private', 'has_consent', 'authenticated')
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
-- owned by postgres and pin search_path to empty (fixed rule, no
-- allowlist: see the shared query above).
select is(
  (select count(*)::int from pg_temp.__catalog_definer_violations()),
  0,
  'every SECURITY DEFINER function in public/private is owned by postgres and pins search_path to empty'
);

-- 7-pos. Positive triangulation for check 7: a SECURITY DEFINER function
-- owned by postgres with `set search_path = ''` -- the CORRECT shape
-- every later slice's definers use -- must NOT be counted as a violation.
-- Without this, the guard's own query drifting back to matching the
-- literal `search_path=` (instead of the actual stored `search_path=""`)
-- would silently flag every correctly-configured definer added later.
create function private.__catalog_guard_good_definer()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
end;
$fn$;

select is(
  (
    select count(*)::int
    from pg_temp.__catalog_definer_violations()
    where function_name = '__catalog_guard_good_definer'
  ),
  0,
  'the guard does not flag a correctly-owned SECURITY DEFINER function that pins search_path to empty'
);

drop function private.__catalog_guard_good_definer();

-- 7b. Negative triangulation for check 7: create a SECURITY DEFINER
-- function that intentionally omits `set search_path = ''`, prove the
-- guard's own ownership/search_path scan flags it, then explicitly drop
-- it.
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
    from pg_temp.__catalog_definer_violations()
    where function_name = '__catalog_guard_bad_definer'
  ) > 0,
  true,
  'the guard flags a SECURITY DEFINER function that does not pin search_path to empty'
);

drop function private.__catalog_guard_bad_definer();

select * from finish();

rollback;
