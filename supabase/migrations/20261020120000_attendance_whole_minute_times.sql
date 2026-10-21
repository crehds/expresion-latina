-- Whole-minute class times on attendance confirmations (Design: D1 occurrence
-- identity). Proven by supabase/tests/database/attendance_confirmations.test.sql.
--
-- An occurrence is identified client-side by 'HH:MM' (schedule slots are whole
-- minutes). RLS never looks at start_time beyond the starts_at trigger, so a
-- member could insert '19:00:30': a row no schedule slot can ever match, which
-- the admin mismatch view would have to treat as malformed. Rejecting it at the
-- source lets the app adapter accept only 'HH:MM' or 'HH:MM:00' and fail loudly
-- on anything else instead of silently truncating.
--
-- Built-in functions only: a CHECK must not call a user-defined function. The
-- constraints bind every writer, service_role included. Existing rows are
-- validated on creation; every row written through the app so far came from a
-- schedule slot, so they are all whole minutes.
alter table public.attendance_confirmations
  add constraint attendance_confirmations_start_time_whole_minute
    check (extract(second from start_time) = 0),
  add constraint attendance_confirmations_end_time_whole_minute
    check (extract(second from end_time) = 0);
