-- Synthetic local-only seed data. Never real personal data, and never
-- meant to run against a hosted/linked project: `supabase db reset`
-- (which `npm run test:db` and `supabase db start` on a fresh volume both
-- trigger) is the only thing that runs this file.

-- The migration that creates privacy_notice_versions already seeds this
-- row (a valid version has to exist in every environment for sign-up to
-- work at all -- that is schema, not sample data). Repeated here with
-- `on conflict do nothing` only so this file stays safe to re-run.
insert into
  public.privacy_notice_versions (version)
values
  ('2026-01-01')
on conflict (version) do nothing;

-- One fake member, so a fresh local stack has something to look at (e.g.
-- in Supabase Studio) without running a real sign-up first. `example.test`
-- is the RFC 6761 reserved test domain, not a real address.
insert into
  auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    '00000000-0000-0000-0000-0000000000f0',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'seed-member@example.test',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Seed Member","consent_version":"2026-01-01"}',
    now(),
    now()
  )
on conflict (id) do nothing;
