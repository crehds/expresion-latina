-- Profiles + consent (Design: D5 consent sequence, Database Security
-- Contract; Spec: Consent Before Account Creation, Consent Record, Account
-- Registration, Data Protection). Proven by
-- supabase/tests/database/profiles_consent.test.sql.
--
-- Every table and SECURITY DEFINER function created here ends with an
-- explicit `revoke ... from public, anon, authenticated`, then grants only
-- what the Database Security Contract lists: Supabase's own default
-- privileges (ALTER DEFAULT PRIVILEGES, seen on the local stack) already
-- hand anon/authenticated/service_role full DML and EXECUTE on anything a
-- migration creates, so skipping the revoke would silently over-grant.

-- No personal data: just the notice versions members can consent to.
create table public.privacy_notice_versions (
  version text primary key,
  published_at timestamptz not null default now()
);

revoke all on public.privacy_notice_versions from public, anon, authenticated;

-- Seeded here (not in seed.sql, which is local/dev-only data) because a
-- valid version must exist in every environment for a sign-up to succeed
-- at all -- it is part of the schema's contract, not sample data.
insert into public.privacy_notice_versions (version) values ('2026-01-01');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  consent_version text references public.privacy_notice_versions (version),
  consent_at timestamptz,
  is_admin boolean not null default false
);

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
-- Column-scoped: no client, admin included, can write is_admin, consent_*
-- or (later slices) recorded_by directly.
grant update (full_name) on public.profiles to authenticated;

-- RLS policy helpers (Design F3). Both are SECURITY DEFINER so they can
-- read `profiles` without recursing back through its own SELECT policy
-- (which itself calls private.is_admin()), and both pin search_path to
-- '' and schema-qualify every name so a caller-controlled search_path can
-- never redirect them. `private` grants only EXECUTE per function, plus
-- schema USAGE to `authenticated` so it can resolve the call in the first
-- place -- the functions stay the only reachable surface.
grant usage on schema private to authenticated;

create function private.has_consent(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = p_id and p.consent_at is not null
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = auth.uid() and p.consent_at is not null
    ),
    false
  );
$$;

revoke execute on function private.has_consent (uuid) from public, anon, authenticated;
grant execute on function private.has_consent (uuid) to authenticated;
revoke execute on function private.is_admin () from public, anon, authenticated;
grant execute on function private.is_admin () to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid ())
  or private.is_admin ()
);

create policy profiles_update_full_name on public.profiles
for update
  to authenticated using (
    id = (select auth.uid ())
    and private.has_consent ((select auth.uid ()))
  )
with
  check (
    id = (select auth.uid ())
    and private.has_consent ((select auth.uid ()))
  );

-- Consent is given in the UI before any sign-in or sign-up starts (Design
-- D5.1). `raw_app_meta_data->>'provider'` is already set on the row this
-- trigger sees, for both a fresh email account and a fresh Google account
-- (Verified Platform Fact #3). Fail closed: any provider other than email
-- or google raises, so no account is ever left without a profile.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_consent_version text;
  v_full_name text;
begin
  v_provider := new.raw_app_meta_data ->> 'provider';

  if v_provider = 'email' then
    v_consent_version := new.raw_user_meta_data ->> 'consent_version';
    if v_consent_version is null then
      raise exception 'consent_version is required for email sign-up' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.privacy_notice_versions v where v.version = v_consent_version
    ) then
      raise exception 'unknown privacy notice version: %', v_consent_version using errcode = '22023';
    end if;

    v_full_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
    if char_length(v_full_name) < 1 or char_length(v_full_name) > 120 then
      raise exception 'full_name must be between 1 and 120 characters' using errcode = '22023';
    end if;

    insert into public.profiles (id, full_name, consent_version, consent_at)
    values (new.id, v_full_name, v_consent_version, now());
  elsif v_provider = 'google' then
    -- PENDING: no consent yet, no name yet. The Consent gate blocks every
    -- member action until record_consent runs (Design D5.3c/d), and the
    -- hourly purge (PR3) deletes the account if that never happens.
    insert into public.profiles (id, full_name, consent_version, consent_at)
    values (new.id, '', null, null);
  else
    raise exception 'unknown auth provider: %', v_provider using errcode = '22023';
  end if;

  return new;
end;
$$;

-- No EXECUTE grant to anyone: Postgres does not check EXECUTE privilege
-- for a trigger's own invocation, only for a direct function call, so
-- sign-up keeps working with the client roles fully revoked (proven by
-- profiles_consent.test.sql).
revoke execute on function private.handle_new_user () from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function private.handle_new_user ();

-- record_consent (Design D5.4/D5.6): accepts the notice for a pending
-- profile or re-consent after a version bump. Consent-free surface (no
-- has_consent check): a pending account needs this to leave PENDING.
create function public.record_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  if not exists (select 1 from public.privacy_notice_versions v where v.version = p_version) then
    raise exception 'unknown privacy notice version: %', p_version using errcode = '22023';
  end if;

  -- Only used to fill in the name the first time (profile still PENDING);
  -- a re-consent leaves full_name as the member already set it.
  select btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''))
  into v_full_name
  from auth.users u
  where u.id = auth.uid ();

  update public.profiles p
  set
    consent_version = p_version,
    consent_at = now(),
    full_name = case
      when p.consent_at is null and coalesce(v_full_name, '') <> '' then left(v_full_name, 120)
      else p.full_name
    end
  where p.id = auth.uid ();
end;
$$;

revoke execute on function public.record_consent (text) from public, anon, authenticated;
grant execute on function public.record_consent (text) to authenticated;
