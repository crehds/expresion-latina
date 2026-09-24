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
  same version as CI (see the header comment in `scripts/db/test-db.mjs`)

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
domain. It never contains real personal data, and `supabase db reset`
(including `npm run test:db`) is the only thing that runs it.

## What's here

| Path              | What                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `config.toml`     | Local stack config -- only the settings this project depends on (see the file's own header) |
| `migrations/`     | Schema, RLS, grants, triggers, RPCs, applied in filename order; never contains data         |
| `tests/database/` | pgTAP suite, run by `npm run test:db` and CI (`.github/workflows/db-tests.yml`)             |
| `seed.sql`        | Synthetic local dev data (see above)                                                        |
