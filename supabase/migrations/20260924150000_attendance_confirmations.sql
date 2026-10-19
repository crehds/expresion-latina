-- Attendance confirmations + the starts_at trigger (Design: D1 occurrence
-- identity, D2 the DB learns start times, D4 confirm after paid-until,
-- Database Security Contract; Spec: Confirm Attendance, Cancel Attendance).
-- Proven by supabase/tests/database/attendance_confirmations.test.sql.
--
-- Every table and SECURITY DEFINER function created here ends with an
-- explicit `revoke ... from public, anon, authenticated`, then grants only
-- what the Database Security Contract lists (see
-- 20260924130000_profiles_and_consent.sql: Supabase's own default
-- privileges already hand anon/authenticated/service_role full DML and
-- EXECUTE on anything a migration creates, so skipping the revoke would
-- silently over-grant).

-- The database never stores the schedule and never syncs it (Design D2):
-- class_date, start_time, end_time, genre_id, room_key, genre_name and
-- room_label are all supplied by the authenticated client from the static
-- schedule it already has (src/data). A fabricated value describes an
-- occurrence that simply does not exist on the real schedule -- it does no
-- harm (Design D2), and the admin's client-side diff (a later slice) flags
-- it. The slug and length CHECKs below only bound the shape of that client
-- input (matching src/data/academy.schema.json's own slug pattern for
-- genre ids, and Design D1's "room_key = slug of session.room"), the same
-- defensive-input role the paid_periods CHECKs play for admin input.
create table public.attendance_confirmations (
  id uuid primary key default gen_random_uuid (),
  -- Defaults to the caller and never appears in the client's own INSERT
  -- column grant at all (see the grants below) -- a member can only ever
  -- confirm as themselves, never forge another member's id, the same
  -- defense-in-depth shape paid_periods.recorded_by uses.
  member_id uuid not null default auth.uid () references public.profiles (id) on delete cascade,
  -- Design D1: the occurrence identity is (class_date, start_time,
  -- genre_id, room_key), built only by attendance/domain/occurrences.js (a
  -- later slice); end_time, genre_name and room_label are snapshots kept
  -- for display only and play no part in identity or any policy check.
  class_date date not null,
  start_time time not null,
  end_time time not null,
  genre_id text not null,
  room_key text not null,
  genre_name text not null,
  room_label text not null,
  -- Computed by the BEFORE INSERT trigger below (Design D2), never by the
  -- client: no default, and (see the grants below) no INSERT grant on
  -- this column at all, so a client-submitted value here is rejected
  -- before it could ever reach the trigger. confirm_own's WITH CHECK
  -- trusts this column precisely because the client cannot set it.
  starts_at timestamptz not null,
  created_at timestamptz not null default now (),
  -- Literal values only, never a function call (PR1b3 lesson): Postgres
  -- checks EXECUTE on any function a CHECK constraint calls, for every
  -- role that writes the table, including service_role.
  constraint attendance_confirmations_genre_id_format check (
    char_length(genre_id) between 1 and 60
    and genre_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint attendance_confirmations_room_key_format check (
    char_length(room_key) between 1 and 60
    and room_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint attendance_confirmations_genre_name_length check (char_length(genre_name) between 1 and 120),
  constraint attendance_confirmations_room_label_length check (char_length(room_label) between 1 and 120),
  -- Design D1: a member confirming the exact same occurrence twice raises
  -- 23505 instead of creating a second row; the future adapter treats
  -- that as idempotent rather than surfacing it as an error.
  constraint attendance_confirmations_unique_occurrence unique (member_id, class_date, start_time, genre_id, room_key)
);

alter table public.attendance_confirmations enable row level security;

revoke all on public.attendance_confirmations from public, anon, authenticated;
grant select on public.attendance_confirmations to authenticated;
-- "Occurrence columns only" (Database Security Contract): member_id relies
-- entirely on its default (above) and starts_at is trigger-only, so
-- neither is grantable here -- a client cannot forge either one.
grant insert (
  class_date, start_time, end_time, genre_id, room_key, genre_name, room_label
) on public.attendance_confirmations to authenticated;
grant delete on public.attendance_confirmations to authenticated;
-- No UPDATE grant at all, to anyone: a confirmation is created or removed,
-- never edited (Database Security Contract: "Nobody gets ... UPDATE on
-- confirmations").

-- The BEFORE INSERT trigger (Design D2): the only place `starts_at` is
-- ever set. Not SECURITY DEFINER -- like private.lima_today(), it reads
-- no table, only the row being inserted, so it needs no elevated
-- privilege and runs as whichever role performs the insert. search_path
-- is still pinned empty and every name schema-qualified (Design F3
-- applies to every function regardless of definer status).
create function private.set_attendance_starts_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- America/Lima has no DST (fixed UTC-05:00, limaCalendar convention):
  -- "AT TIME ZONE" on a plain timestamp reads it as wall-clock time IN
  -- that zone and returns the equivalent timestamptz -- the absolute
  -- instant the class actually starts.
  new.starts_at := (new.class_date + new.start_time) at time zone 'America/Lima';
  return new;
end;
$$;

-- No EXECUTE grant to anyone: Postgres does not check EXECUTE privilege
-- for a trigger's own invocation (same fact private.handle_new_user's
-- comment records), only for a direct function call, so every insert
-- keeps working with every client role fully revoked. Still revoked
-- explicitly for grant hygiene (Design F6) -- the catalog guard would
-- otherwise flag Supabase's own default EXECUTE grant.
revoke execute on function private.set_attendance_starts_at () from public, anon, authenticated;

create trigger attendance_confirmations_set_starts_at
before insert on public.attendance_confirmations for each row
execute function private.set_attendance_starts_at ();

-- private.can_confirm (Design D4, Database Security Contract policy
-- helper): true only when the member has recorded consent AND is active
-- today AND the class date is covered by (any of) their paid periods --
-- the "active today" and "date covered" windows are independent
-- existence checks against paid_periods, not necessarily the same row
-- (Design D4: "The member must be active today AND the class date must
-- be covered by a paid period"). SECURITY DEFINER for the same reason as
-- is_admin/has_consent: a clean, RLS-independent policy helper, consistent
-- with the Database Security Contract listing all three together.
create function private.can_confirm(p_member_id uuid, p_class_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_consent (p_member_id)
    and exists (
      select 1
      from public.paid_periods pp
      where
        pp.member_id = p_member_id
        and pp.starts_on <= private.lima_today ()
        and pp.ends_on >= private.lima_today ()
    )
    and exists (
      select 1
      from public.paid_periods pp
      where
        pp.member_id = p_member_id
        and pp.starts_on <= p_class_date
        and pp.ends_on >= p_class_date
    );
$$;

revoke execute on function private.can_confirm (uuid, date) from public, anon, authenticated;
grant execute on function private.can_confirm (uuid, date) to authenticated;

-- Member reads their own confirmations, admin reads all (Database
-- Security Contract) -- same combined-policy shape as profiles_select and
-- paid_periods_select.
create policy attendance_confirmations_select on public.attendance_confirmations for select to authenticated using (
  (
    member_id = (select auth.uid ())
    and (select private.has_consent ((select auth.uid ())))
  )
  or (select private.is_admin ())
);

-- Exact SQL from the design (Interfaces): the third WITH CHECK clause is
-- the design's own inline comment, "consent + active today + date
-- covered" -- all three folded into private.can_confirm above. class_date
-- is passed unwrapped, not `(select ...)`: it is correlated to the row
-- being inserted, not constant for the whole statement (same reasoning as
-- paid_periods_admin_insert's private.has_consent(member_id), PR2a
-- corrective re-run).
create policy confirm_own on public.attendance_confirmations for insert to authenticated
with check (
  member_id = (select auth.uid ())
  and starts_at > now ()
  and starts_at <= now () + interval '7 days'
  and private.can_confirm ((select auth.uid ()), class_date)
);

-- Exact SQL from the design (Interfaces).
create policy cancel_own_before_start on public.attendance_confirmations for delete to authenticated
using (
  member_id = (select auth.uid ())
  and private.has_consent ((select auth.uid ()))
  and starts_at > now ()
);
