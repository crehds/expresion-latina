-- Paid periods + member directory (Design: D3 period arithmetic, D9 admin
-- model, Database Security Contract, Interfaces; Spec: Member Directory,
-- Recording Paid Periods, Correcting Paid Periods, Payment Privilege
-- Restriction). Proven by supabase/tests/database/paid_periods.test.sql.
--
-- Every table and SECURITY DEFINER function created here ends with an
-- explicit `revoke ... from public, anon, authenticated`, then grants only
-- what the Database Security Contract lists (see
-- 20260924130000_profiles_and_consent.sql: Supabase's own default
-- privileges already hand anon/authenticated/service_role full DML and
-- EXECUTE on anything a migration creates, so skipping the revoke would
-- silently over-grant).

-- daterange's own GiST opclass already handles the `&&` overlap operator;
-- btree_gist adds a GiST opclass for `=` on scalar types (here, `member_id
-- uuid`) so one EXCLUDE constraint can combine per-member equality with
-- date-range overlap. Installed into `extensions`, not `public` (PR1b3
-- gotcha): the catalog privilege guard already excludes extension-owned
-- objects (pg_depend deptype = 'e') from every scan, so this never needs
-- an allowlist entry.
create extension if not exists btree_gist with schema extensions;

-- private.lima_today(): the SQL half of Design D3's Lima-calendar rule
-- (`todayInLima(now)` is the JS half, PR4a). Not SECURITY DEFINER: it reads
-- no table, only wall-clock time, so it needs no elevated privilege and
-- gets none -- every call site so far (admin_search_members below, later
-- slices' purge/attendance functions) runs it from inside another SECURITY
-- DEFINER body, i.e. as postgres, where EXECUTE is never checked. search_
-- path is still pinned empty, matching every function in `private`
-- regardless of definer status.
create function private.lima_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Lima')::date;
$$;

revoke execute on function private.lima_today () from public, anon, authenticated;

create table public.paid_periods (
  id uuid primary key default gen_random_uuid (),
  member_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  -- A reversed range (ends_on before starts_on) used to reach no explicit
  -- CHECK at all: it only failed inside daterange() when the EXCLUDE
  -- constraint below built its index entry, with a generic data_exception
  -- (22000) instead of a clear, catchable check_violation. CHECK
  -- constraints are evaluated before a row ever reaches index insertion,
  -- so this always fires first, with the standard 23514 code; a one-day
  -- period (ends_on = starts_on) is still allowed.
  constraint paid_periods_ordered check (ends_on >= starts_on),
  -- Catches typos (a stray extra digit turning a month into decades), not a
  -- product limit (Design D3). A literal interval, not a named function:
  -- Postgres checks EXECUTE on any function a CHECK constraint calls, for
  -- every role that writes the table, including service_role -- the exact
  -- bug fixed in the profiles CHECK (PR1b3).
  constraint paid_periods_max_5_years check (ends_on <= (starts_on + interval '5 years')::date),
  -- Admin-recorded only (Database Security Contract below): defaults to
  -- the writer's own id and gets no client grant on this column at all
  -- (see the grants below), so it always names the admin who FIRST
  -- recorded the row -- a later correction (starts_on/ends_on only) can
  -- never change it.
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid (),
  created_at timestamptz not null default now (),
  -- Design D3: back-to-back periods never overlap (inclusive '[]' bounds
  -- on both ends), a double-submitted save becomes an error instead of a
  -- duplicate, and this is scoped per member (`member_id with =`) so two
  -- different members' overlapping dates are unrelated.
  constraint paid_periods_no_overlap exclude using gist (
    member_id with =,
    daterange (starts_on, ends_on, '[]') with &&
  )
);

alter table public.paid_periods enable row level security;

revoke all on public.paid_periods from public, anon, authenticated;
grant select on public.paid_periods to authenticated;
-- Column-scoped, same shape as profiles.full_name (PR1b): the grant alone
-- does not let a member write here -- only the admin-only policies below
-- do. Column-scoping still keeps `recorded_by` (and, on UPDATE, `member_
-- id`) out of reach for anyone, admin included, the same defense-in-depth
-- the Contract applies everywhere else.
grant insert (member_id, starts_on, ends_on) on public.paid_periods to authenticated;
grant update (starts_on, ends_on) on public.paid_periods to authenticated;
grant delete on public.paid_periods to authenticated;

create policy paid_periods_select on public.paid_periods for select to authenticated using (
  (
    member_id = (select auth.uid ())
    and (select private.has_consent ((select auth.uid ())))
  )
  or (select private.is_admin ())
);

-- An admin can only record a period for a member who has accepted the
-- privacy notice. Without this check, a payment could be attached to a
-- pending account that the pending-consent purge (PR3) deletes
-- automatically if the person never accepts, before they ever confirm
-- they want an account at all -- a payment can never exist for an
-- account that cannot hold one.
-- private.has_consent(member_id) is called directly, not wrapped in a
-- `(select ...)` InitPlan: it depends on the row being inserted, not on
-- a value fixed for the whole statement, so it must be evaluated per
-- row. This policy only constrains client roles acting as
-- `authenticated`; service_role bypasses row level security entirely
-- and remains a trusted backend path outside every policy in this file.
create policy paid_periods_admin_insert on public.paid_periods for insert to authenticated
with check (
  (select private.is_admin ())
  and private.has_consent (member_id)
);

create policy paid_periods_admin_update on public.paid_periods
for update
  to authenticated using (
    (select private.is_admin ())
  )
with
  check (
    (select private.is_admin ())
  );

create policy paid_periods_admin_delete on public.paid_periods for delete to authenticated using (
  (select private.is_admin ())
);

-- admin_search_members (Design Interfaces; Spec Member Directory): the
-- directory search. SECURITY DEFINER so it can read auth.users.email (no
-- client role has table access there) and every member's profile/periods
-- regardless of RLS, gated by its own explicit admin check instead of the
-- per-row policies above.
create function public.admin_search_members(q text, lim int default 50)
returns table (
  id uuid,
  full_name text,
  email text,
  paid_until date,
  is_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin () then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    max(pp.ends_on) as paid_until,
    coalesce(
      bool_or (pp.starts_on <= private.lima_today () and pp.ends_on >= private.lima_today ()),
      false
    ) as is_active
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.paid_periods pp on pp.member_id = p.id
  where
    (
      -- position(), not ilike: '%' and '_' in q are literal characters
      -- here, never SQL LIKE wildcards (Design Interfaces). Case-
      -- insensitive on both sides for a forgiving directory search -- the
      -- "not a wildcard" rule only concerns the two LIKE metacharacters
      -- themselves.
      position(lower(q) in lower(p.full_name)) > 0
      or position(lower(q) in lower(u.email)) > 0
    )
    -- The directory lists consented members only. A pending account
    -- (created by Google sign-in before the person accepts the privacy
    -- notice) has no recorded consent, gets deleted automatically about
    -- 23 hours after it is created if that never changes, and would
    -- otherwise expose the email of someone who never agreed to
    -- anything. The member becomes searchable the moment they accept the
    -- notice on their next sign-in.
    and p.consent_at is not null
  group by
    p.id,
    p.full_name,
    u.email
  order by p.full_name
  limit lim;
end;
$$;

revoke execute on function public.admin_search_members (text, int) from public, anon, authenticated;
grant execute on function public.admin_search_members (text, int) to authenticated;
