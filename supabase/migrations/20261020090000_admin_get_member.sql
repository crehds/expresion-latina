-- Member lookup by id (Design: Interfaces, D10 route /admin/members/:memberId;
-- Spec: Member Directory). Proven by
-- supabase/tests/database/admin_get_member.test.sql.
--
-- The admin's member detail page needs the name and email of ONE member, and
-- has no other safe way to get them: `profiles` holds no email, `auth.users`
-- is unreachable for every client role, and an admin who read `profiles`
-- directly would see pending and unconfirmed accounts too -- exactly the ones
-- admin_search_members and the paid_periods insert policy hide.
--
-- Same shape as admin_search_members (20260924140000_paid_periods.sql): a
-- SECURITY DEFINER function with an empty search_path, the explicit admin
-- check first, the same five columns, the same status rules (paid_until is
-- the latest end of ALL the member's periods, a future one included;
-- is_active is whether a period covers private.lima_today ()) and the same two
-- gates in the WHERE clause: consent recorded AND email confirmed. A member
-- who fails a gate, an id that belongs to nobody and a NULL id all answer the
-- same way, with no rows and no error, so the answer never tells the admin
-- which of them it was. The two functions are kept in step by a test that
-- compares them over the same fixtures.
--
-- Like every function created in this folder it ends with an explicit
-- `revoke ... from public, anon, authenticated`, then grants EXECUTE to
-- `authenticated` only (see 20260924130000_profiles_and_consent.sql:
-- Supabase's default privileges would otherwise hand anon the function).
create function public.admin_get_member(p_id uuid)
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
    p.id = p_id
    -- The directory's own gates (owner decision 2026-09-26): the member
    -- accepted the privacy notice and confirmed the address. See the
    -- comment on the same two lines in admin_search_members for why each
    -- one is needed on its own.
    and p.consent_at is not null
    and u.email_confirmed_at is not null
  group by
    p.id,
    p.full_name,
    u.email;
end;
$$;

revoke execute on function public.admin_get_member (uuid) from public, anon, authenticated;
grant execute on function public.admin_get_member (uuid) to authenticated;
