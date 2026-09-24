# Supabase (local stack)

Schema, tests and local dev seed data for the Member Attendance feature.
Nothing here talks to a hosted Supabase project unless someone explicitly
runs `supabase link` and `supabase db push` -- this project's own scripts
never do that (see `scripts/db/test-db.mjs`).

This is a stub. First-admin setup, SMTP, Google OAuth, the redirect
allowlist and production secrets land here as the later slices that need
them are implemented.

## Prerequisites

- Docker running -- the CLI needs it to start the local Postgres, Auth and
  storage stack
- No separate CLI install: everything runs through `npx`, pinned to the
  same version as CI (see the `SUPABASE_CLI` comment in
  `scripts/db/test-db-lib.mjs`)

## Bootstrapping

```bash
npm run test:db
```

This starts the local stack if it is not already running (the first run
pulls Docker images and can take a few minutes), resets the local database
from `supabase/migrations/`, loads `supabase/seed.sql`, and runs the pgTAP
suite under `supabase/tests/database/`. `scripts/db/test-db.mjs` documents
exactly what each step does, including why it warns before every reset.

To run the stack without resetting or testing -- to browse it in Supabase
Studio, for example:

```bash
npx --yes supabase@2.117.0 db start
npx --yes supabase@2.117.0 status
```

`status` prints the Studio URL, the database connection string, and
Mailpit's inbox URL. Mailpit catches every email the local Auth service
sends (confirmation links, password resets), so nothing needs a real SMTP
account to test locally.

Stop the stack when done:

```bash
npx --yes supabase@2.117.0 stop
```

## Seed data

`supabase/seed.sql` is synthetic local-only data: one privacy notice
version and one fake member, on the RFC 6761 reserved `example.test`
domain. It never contains real personal data. It runs whenever migrations
are applied to a fresh or reset local database -- `supabase db reset`
(including `npm run test:db`), or `supabase db start` the first time it
initializes a brand new local Docker volume (the path CI relies on, since
it never resets).

## Email sign-up requires a consent version

`private.handle_new_user` (the `auth.users` trigger, see
`supabase/migrations/20260924130000_profiles_and_consent.sql`) rejects any
`provider = 'email'` account whose sign-up metadata has no
`consent_version` naming a row in `privacy_notice_versions`. A user
created directly in the Supabase Studio dashboard, or invited by email,
never sets that metadata, so the insert into `auth.users` is rejected and
no account is created. This is intentional and the trigger is not an
exception for it: consent has to be given in the app's own sign-up UI
before an account can exist (Design D5).

This means the **first admin has to sign up through the app** like any
other member -- the sign-up form sends `consent_version` on their behalf
-- and is then promoted with SQL, in the Supabase Studio SQL editor:

```sql
update public.profiles set is_admin = true where id = (
  select id from auth.users where email = 'owner@example.com'
);
```

## What's here

| Path              | What                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `config.toml`     | Local stack config -- only the settings this project depends on (see the file's own header) |
| `migrations/`     | Schema, RLS, grants, triggers, RPCs, applied in filename order; never contains data         |
| `tests/database/` | pgTAP suite, run by `npm run test:db` and CI (`.github/workflows/db-tests.yml`)             |
| `seed.sql`        | Synthetic local dev data (see above)                                                        |
