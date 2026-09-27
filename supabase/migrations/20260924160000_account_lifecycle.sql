-- Account lifecycle: self-service deletion and the scheduled purges
-- (Design: D6 deletion + retention, Database Security Contract; Spec:
-- Account Deletion, Consent Before Account Creation (24h purge),
-- Attendance Retention). Proven by
-- supabase/tests/database/account_lifecycle.test.sql.
--
-- Every SECURITY DEFINER function created here ends with an explicit
-- `revoke ... from public, anon, authenticated`, then grants only what
-- the Database Security Contract lists (see
-- 20260924130000_profiles_and_consent.sql: Supabase's own default
-- privileges already hand every built-in client role EXECUTE on
-- anything a migration creates, so skipping the revoke would silently
-- over-grant). Every function here also sets `search_path = ''` and
-- schema-qualifies every name (Design F3), regardless of definer status.

-- private.delete_account (Design D6): the single place an auth user is
-- ever deleted. `delete_my_account()` and every purge function below
-- call this instead of running `DELETE FROM auth.users` themselves, so
-- there is exactly one deletion primitive to audit. The row cascades
-- through existing foreign keys: to auth.sessions directly, and to
-- public.profiles (id references auth.users on delete cascade), which in
-- turn cascades to public.paid_periods and public.attendance_confirmations
-- (both reference profiles(id) on delete cascade) -- no cascade logic is
-- written here, it is already declared on those tables. SECURITY
-- DEFINER, owned by postgres, for the same reason private.handle_new_user
-- is: only postgres (directly, or as the owner of every SECURITY DEFINER
-- caller below) ever needs to reach this, and Supabase's documented,
-- community-proven route for deleting an auth user from inside the
-- database (Verified Platform Fact: "DELETE FROM auth.users in a
-- postgres-owned SECURITY DEFINER function works") requires exactly this
-- shape.
-- Returns the number of rows actually deleted (0 or 1, since id is the
-- primary key) so every caller can tell "deleted" apart from "there was
-- nothing to delete" -- delete_my_account() (owner decision 2026-09-26,
-- review advisory U) raises on 0, and every purge below sums this
-- return value into its own logged count instead of counting loop
-- iterations, so a row that somehow no longer exists is never counted
-- as deleted.
create function private.delete_account(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  delete from auth.users where id = p_id;
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke execute on function private.delete_account (uuid) from public, anon, authenticated;

-- delete_my_account (Design D5/D6, Database Security Contract): the
-- self-service RPC. Consent-free by construction -- it contains no
-- private.has_consent check -- because a still-pending account must be
-- able to leave immediately on decline (Design D5.3d: "Decline calls
-- delete_my_account and then signOut"), not wait for the hourly purge.
-- It only ever deletes auth.uid(), the caller's own id: there is no
-- parameter, so no client input ever names a different account.
--
-- Two failure modes raise instead of silently "succeeding" (owner
-- decision 2026-09-26, review advisory U), the same discipline
-- public.record_consent already applies to its own missing-row case: a
-- null auth.uid() (no authenticated caller at all -- the same errcode
-- admin_search_members already uses for "not allowed to do this") and a
-- delete that removed zero rows (the caller's account was already gone
-- -- P0002, matching record_consent's own "no profile found" raise).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_deleted_count integer;
begin
  v_uid := auth.uid ();
  if v_uid is null then
    raise exception 'no authenticated user' using errcode = '42501';
  end if;

  v_deleted_count := private.delete_account (v_uid);

  if v_deleted_count = 0 then
    raise exception 'no account was deleted' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_my_account () from public, anon, authenticated;
grant execute on function public.delete_my_account () to authenticated;

-- private.purge_pending_consent_accounts (Design D6a; spec: "Consent
-- Before Account Creation", "Google account without a recorded
-- consent"). A pending account is one with no recorded consent at all
-- (profiles.consent_at is null) -- an email sign-up always gets
-- consent_at set in the same transaction as its auth.users row (the
-- handle_new_user trigger raises without it), so in practice only a
-- Google sign-up before its post-callback record_consent call can ever
-- match. A pending account can never hold a paid period (the
-- paid_periods_admin_insert policy already requires has_consent on the
-- member being paid), so this purge can never delete a payment.
create function private.purge_pending_consent_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.consent_at is null
      -- 23h, not 24h: this function runs hourly (cron schedule below,
      -- '17 * * * *'), so a pending account created just after one run
      -- is always caught by the next one, at most 23h59m later -- 23h
      -- plus that worst-case wait never exceeds 24h since sign-up,
      -- matching Design D6a's "within 24 hours" guarantee exactly.
      and u.created_at < now() - interval '23 hours'
  loop
    v_count := v_count + private.delete_account (v_id);
  end loop;

  raise log 'purge_pending_consent_accounts deleted % account(s)', v_count;

  return v_count;
end;
$$;

revoke execute on function private.purge_pending_consent_accounts () from public, anon, authenticated;

-- private.purge_unconfirmed_email_accounts (spec: "Consent Before
-- Account Creation" is about the pending-consent purge above; this
-- function is a separate, narrower cleanup for a different failure
-- mode -- an email sign-up that recorded consent but never confirmed
-- its address).
--
-- UNCONFIRMED OWNER DEFAULT: the owner has not confirmed this 7-day
-- threshold. It is kept in its own named function, separate from every
-- other purge criterion, precisely so it can change independently
-- without touching the others.
create function private.purge_unconfirmed_email_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select u.id
    from auth.users u
    where u.raw_app_meta_data ->> 'provider' = 'email'
      and u.email_confirmed_at is null
      and u.created_at < now() - interval '7 days'
  loop
    v_count := v_count + private.delete_account (v_id);
  end loop;

  raise log 'purge_unconfirmed_email_accounts deleted % account(s)', v_count;

  return v_count;
end;
$$;

revoke execute on function private.purge_unconfirmed_email_accounts () from public, anon, authenticated;

-- private.purge_dormant_accounts (Design D6c; spec: "Account Deletion",
-- "Two years of silence" -- "no sign-in AND no payment"). An account is
-- dormant only when EVERY one of five activity signals is at least 2
-- years old: when it was created, when it last signed in, the last time
-- any of its sessions refreshed, and the end date and the record date of
-- its most recent paid period (an admin recording or extending a period
-- counts as activity on the account, independent of whether that period
-- still covers today). greatest() ignores whichever signals are null (a
-- member who never signed in, or never paid) and returns null only if
-- every argument is null -- which cannot happen here, since created_at
-- always has a value. auth.sessions.refreshed_at is stored without a
-- time zone and public.paid_periods.ends_on is a plain date; both are
-- cast to timestamptz so greatest() can compare them against the other,
-- already time-zone-aware columns -- the local database (and the hosted
-- project, matched in db.major_version and expected to match in
-- TimeZone) runs in UTC, so a zone-less value is read as UTC, exactly as
-- the design specifies.
create function private.purge_dormant_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select u.id
    from auth.users u
    left join auth.sessions s on s.user_id = u.id
    left join public.paid_periods pp on pp.member_id = u.id
    group by u.id, u.created_at, u.last_sign_in_at
    having greatest(
      u.created_at,
      u.last_sign_in_at,
      max(s.refreshed_at)::timestamptz,
      max(pp.ends_on)::timestamptz,
      max(pp.created_at)
    ) < now() - interval '2 years'
  loop
    v_count := v_count + private.delete_account (v_id);
  end loop;

  raise log 'purge_dormant_accounts deleted % account(s)', v_count;

  return v_count;
end;
$$;

revoke execute on function private.purge_dormant_accounts () from public, anon, authenticated;

-- private.purge_expired_confirmations (Design D6d; spec: "Attendance
-- Retention"). Deletes confirmations directly -- unlike the three
-- functions above, there is no account to delete, only rows in
-- attendance_confirmations. class_date < lima_today() - 30 means a
-- confirmation is kept through its 30th day and removed starting its
-- 31st, matching the spec's own example exactly.
create function private.purge_expired_confirmations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.attendance_confirmations
  where class_date < private.lima_today () - 30;

  get diagnostics v_count = row_count;

  raise log 'purge_expired_confirmations deleted % confirmation(s)', v_count;

  return v_count;
end;
$$;

revoke execute on function private.purge_expired_confirmations () from public, anon, authenticated;

-- private.purge_expired_accounts (Design D6; Database Security
-- Contract: "hourly purge"). Composes the three account purges above
-- PLUS the unrelated attendance-retention purge (Design D6d) into the
-- single entry point pg_cron schedules below -- this comment, and the
-- one on the cron.schedule call itself, are the only places that say
-- so, since the function and job are both named for account purges
-- alone. Granted to nobody, like every function it calls -- pg_cron
-- always runs a scheduled command as the role that scheduled it
-- (postgres, a local superuser, since this migration itself runs as
-- postgres), so no client role ever needs reach here.
--
-- ISOLATION (owner decision 2026-09-26, review advisories Q/R/T): each
-- purge runs inside its own BEGIN/EXCEPTION block instead of one bare
-- sequence of `perform` calls. plpgsql opens an implicit savepoint on
-- entry to any block that has an EXCEPTION clause, and on error rolls
-- back to only that savepoint before continuing after the block -- so a
-- failure inside any one purge (say, a future migration adds an FK that
-- rejects one specific row) is contained to that purge alone and can
-- never roll back the other three, including attendance retention,
-- which must keep running every hour regardless of what happens to
-- account deletion. Without this, all four ran in the single implicit
-- transaction pg_cron opens for the whole function call, so one
-- exception would have rolled back every purge, hourly. Every branch
-- logs its own outcome -- the deleted count on success (inside each
-- purge above), or sqlerrm on failure (here) -- counts and error text
-- only, never an email, name or id.
--
-- NO PER-RUN CAP (review advisory R): none of the four purges limits
-- how many rows it processes in one run. The hosted project starts
-- brand new with no pre-existing legacy users to sweep, so an unbounded
-- scan is an accepted tradeoff for this project, not an oversight.
create function private.purge_expired_accounts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.purge_pending_consent_accounts ();
  exception
    when others then
      raise warning 'purge_pending_consent_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_unconfirmed_email_accounts ();
  exception
    when others then
      raise warning 'purge_unconfirmed_email_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_dormant_accounts ();
  exception
    when others then
      raise warning 'purge_dormant_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_confirmations ();
  exception
    when others then
      raise warning 'purge_expired_confirmations failed: %', sqlerrm;
  end;
end;
$$;

revoke execute on function private.purge_expired_accounts () from public, anon, authenticated;

-- pg_cron (Design D6, D7; Verified Platform Fact: "pg_cron is available
-- on the free plan"). Installed exactly the way Supabase's own official
-- self-hosting guide documents
-- (supabase.com/docs/guides/cron/install): `with schema pg_catalog`
-- places the extension's own catalog entry there, while pg_cron's
-- install script always creates its own `cron` schema regardless -- a
-- schema this project's catalog privilege guard never scans (it only
-- ever looks at `public` and `private`). `postgres` is already a local
-- superuser and does not strictly need these grants, but they match the
-- documented, hosted-compatible installation exactly, so the same
-- migration behaves identically once it eventually reaches a linked
-- project.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Hourly, at :17 (Design D6/D7's own chosen offset, away from the top of
-- the hour). Named so the schedule can be looked up and changed without
-- guessing at an autogenerated job id. Despite the name, this job also
-- runs attendance retention (private.purge_expired_confirmations) --
-- see the comment on private.purge_expired_accounts() above.
select cron.schedule(
  'purge-expired-accounts',
  '17 * * * *',
  $$select private.purge_expired_accounts();$$
);

-- Weekly (Design D6: "A second, weekly cron job deletes cron.job_run_details
-- rows older than 7 d"). pg_cron keeps a row in cron.job_run_details for
-- every run of every job forever until something removes them; this is
-- that something. Sunday 04:00 UTC is an implementation choice (the
-- design names no exact slot), picked to fall outside the hourly job's
-- own :17 minute mark.
select cron.schedule(
  'purge-cron-job-run-details',
  '0 4 * * 0',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days';$$
);
