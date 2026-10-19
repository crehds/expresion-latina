-- Keep-alive heartbeat (Design D7; spec: "Weekly Keep-Alive Ping",
-- "Keep-Alive Failure Detection"). Proven by
-- supabase/tests/database/keepalive.test.sql.
--
-- public.keepalive() is the ONE function in this whole schema granted to
-- anon instead of authenticated: the daily GitHub Actions workflow
-- (.github/workflows/keepalive.yml) calls it using only the publishable
-- ("anon") key -- there is no signed-in session at that point, and there
-- never needs to be one. It takes no parameters and its target row is
-- fixed (id = 1), so nothing about this call is ever influenced by client
-- input.

-- A one-row table: id is pinned to 1 by both the default and the CHECK.
-- This migration itself runs no INSERT -- the table starts empty -- but
-- the only write path into it, the upsert inside public.keepalive()
-- below, also names id explicitly (Design Interfaces:
-- "ops_heartbeat(id=1, last_ping_at)"). RLS on, admin-only SELECT -- the
-- same policy shape every other member-facing table already uses
-- (Database Security Contract), with the admin check
-- wrapped in its own `(select ...)` so the planner evaluates it once per
-- statement rather than once per row (PR1b review follow-up, Supabase RLS
-- performance guidance).
create table public.ops_heartbeat (
  id integer primary key default 1,
  last_ping_at timestamptz not null default now(),
  constraint ops_heartbeat_single_row check (id = 1)
);

alter table public.ops_heartbeat enable row level security;

-- No client role, admin included, ever gets a table-level write grant:
-- Supabase's own default privileges would otherwise hand every built-in
-- client role full DML on this table the moment it is created (see
-- 20260924130000_profiles_and_consent.sql's header comment), so the
-- explicit revoke below is required even though the only grant that
-- follows is a SELECT. The only way any row here is ever written is
-- through public.keepalive() below, a SECURITY DEFINER function owned by
-- postgres -- table ownership bypasses RLS and needs no privilege grant
-- of its own.
revoke all on public.ops_heartbeat from public, anon, authenticated;
grant select on public.ops_heartbeat to authenticated;

create policy ops_heartbeat_select on public.ops_heartbeat for select to authenticated using (
  (select private.is_admin ())
);

-- public.keepalive(): upserts the single row's last_ping_at. ON CONFLICT
-- DO UPDATE (rather than a plain INSERT) is what makes every call after
-- the first one update the existing row instead of raising a duplicate-
-- key error against the primary key -- keepalive.test.sql calls this
-- three times in one test transaction and asserts the row count never
-- leaves 1.
create function public.keepalive()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ops_heartbeat (id, last_ping_at)
  values (1, now())
  on conflict (id) do update set last_ping_at = excluded.last_ping_at;
end;
$$;

revoke execute on function public.keepalive () from public, anon, authenticated;
grant execute on function public.keepalive () to anon;
