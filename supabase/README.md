# Supabase (local stack)

Schema, tests and local dev seed data for the Member Attendance feature.
Nothing here talks to a hosted Supabase project unless someone explicitly
runs `supabase link` and `supabase db push` -- this project's own scripts
never do that (see `scripts/db/test-db.mjs`).

The sections below cover local development first (Prerequisites through
"Local auth"), then everything needed to run this against a real, hosted
project ("Production runbook" onward).

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

## Local auth

`config.toml` sets the local Auth service up the way the app expects:

- **Confirmations are on.** An email account cannot sign in until it has
  followed the link in its confirmation email. The local stack sends no
  real email: every message lands in Mailpit (the URL `status` prints,
  `http://127.0.0.1:54324` by default; its API lists them at
  `/api/v1/messages`).
- **Password rule.** At least 8 characters, with a letter and a digit
  (`minimum_password_length` and `password_requirements`). The sign-up
  form checks the same rule before it asks the server, and a test fails
  if the two drift apart. A hosted project keeps these settings, and
  **Confirm email**, in its own dashboard (Authentication): set the same
  values there.
- **Redirects.** `site_url` and `additional_redirect_urls` allow the Vite
  dev server (`http://localhost:3000`, and `http://127.0.0.1:3000` for the
  callback) to receive a sign-in or an email link.
- **Google is off** until the stack is given a Google OAuth client; until
  then its button ends on an "Unsupported provider" error page. To try it,
  create the client as in "Google sign-in" below, with the local Auth
  callback (`http://127.0.0.1:54321/auth/v1/callback` by default) as an
  authorized redirect URI. Export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the shell that starts the
  stack, uncomment the two `env(...)` lines of `[auth.external.google]` and
  set `enabled = true`, then restart the stack. Keep those edits out of
  commits.
- **Real sign-up journey.** `npm run test:e2e:auth` drives a real sign-up
  through the local stack, in a browser: it builds the site against the
  stack, signs a new `e2e-auth-<time>@example.test` account up on the login
  page, reads the confirmation email from Mailpit, follows its link, checks
  that the member ends on the home page signed in with the consent recorded
  in the database, and signs in again with the password. It deletes that
  account and its email afterwards, whether it passes or not. It needs the
  stack running (see "Bootstrapping") and port 3000 free, and it is not part
  of `npm run test:e2e` or of CI, which has no stack.

## Production runbook

Everything below is for when the owner is ready to run this feature
against a real, hosted Supabase project instead of the local stack. None
of it runs automatically -- every step is a manual dashboard action or
an explicitly authorized `supabase link` / `supabase db push`, never
something this repository's own scripts do on their own.

Rough order: create the Supabase project, push these migrations, sign up
once and promote yourself to admin (see "Email sign-up requires a
consent version" above), configure SMTP and the email rate limit,
configure Google sign-in and the redirect allowlist, set the environment
variables and repository secrets, then verify the keep-alive ping. The
sections below also cover the kill switch, checking the scheduled
purges, and teardown.

### Fresh project only

Every migration in this folder assumes a **fresh** Supabase project with
no pre-existing `auth.users` rows. The trigger that creates a
`public.profiles` row only ever fires on a NEW `auth.users` insert, so
an auth user created before these migrations existed would have no
profile row at all -- and every policy and RPC in this schema reads that
row (directly, or through the admin/consent checks), so that user would
be treated as having no consent and no admin rights instead of failing
with a clear "no profile" error. There is currently no backfill
migration for this. Before linking this project to a Supabase project
that already has real auth users, back-fill a `profiles` row for each
one first (leave `consent_at` null so the existing consent gate makes
them re-consent).

### Email (Gmail SMTP)

Supabase's own built-in email sending is for testing only -- 2 emails an
hour, and only to the project team's own addresses -- never enough for
real sign-ups. Configure custom SMTP instead:

1. Supabase Dashboard -> **Authentication -> Emails -> SMTP Settings**:
   enable custom SMTP with `smtp.gmail.com`, port 587, a Gmail address,
   and a Google **App Password** (not the account's own login password
   -- generate one from the Google Account's security settings).
2. Gmail's own limit for this: **500 recipients a day, 100 per
   message**; going over suspends sending for about 24 hours. That is
   plenty for a small academy, but it is a hard ceiling this project
   cannot raise.
3. Supabase Dashboard -> **Authentication -> Rate Limits**: once custom
   SMTP is configured, set the auth email rate limit to about **30 an
   hour** -- comfortably under Gmail's daily ceiling, generous enough
   for normal sign-up/reset traffic, and small enough to blunt an abuse
   burst. Without custom SMTP this setting stays fixed at Supabase's own
   default of 2/hour.
4. If sign-ups are ever abused (a burst of fake accounts eating into the
   email quota), enable **Authentication -> Bot and Abuse Protection ->
   Enable CAPTCHA protection**, choosing **Cloudflare Turnstile**, with
   a site key and secret key from a Turnstile widget created in the
   Cloudflare dashboard. This is not wired into the sign-up form as of
   this slice -- it is a lever to enable later if abuse ever happens,
   not a default-on control.

### Google sign-in

1. Google Cloud Console: create an OAuth 2.0 Client ID, application type
   **Web application**.
2. **Authorized JavaScript origins**: the production site origin (and
   `http://localhost:<port>` for local testing).
3. **Authorized redirect URIs**: Supabase's own callback URL, shown on
   the Google provider page in the Supabase Dashboard --
   `https://<project-ref>.supabase.co/auth/v1/callback`. This is
   Supabase's callback, not this app's; do not put the app's own
   `/auth/callback` route here.
4. Supabase Dashboard -> **Authentication -> Providers -> Google**:
   paste the Client ID and Client Secret from step 1, then enable the
   provider.

### Redirect allowlist

Supabase Dashboard -> **Authentication -> URL Configuration -> Redirect
URLs** (a different list from step 3 above -- this one is Supabase
redirecting the browser back to _this app_, not Google redirecting to
Supabase). List only the production origin and `localhost`, and nothing
else: no wildcards, no preview-deployment domains. Preview deployments
never receive the Supabase environment variables in the first place
(see below), so they have nothing to redirect back from.

### Environment variables and repository secrets

| Name                            | Value                                                         | Where                                                                                  |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The project's URL, from Supabase Dashboard -> Settings -> API | Vercel (**Production** environment only), and this repository's GitHub Actions secrets |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key from the same page                    | Same as above                                                                          |

The browser only ever receives the publishable key -- never the
project's other, secret API key shown on that same page. That secret
key belongs nowhere in this repository, in Vercel's client-side
environment variables, or in a GitHub Actions secret used by a workflow
that only ever sends anonymous, client-style requests, such as this
one.

Both variables are deliberately **Production only** in Vercel: preview
deployments build with them unset, so the feature stays off and
previews never touch the real database. The same two values, as
repository secrets, are what `.github/workflows/keepalive.yml` uses.

### Kill switch

While `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are unset (or
removed) at build time, every route and control this feature adds stays
off: the rest of the site renders exactly as it does today, and the
Supabase client library is never loaded into the bundle. Vite inlines
environment variables at build time, so turning the feature off -- or
back on -- is a matter of changing the Vercel environment variables and
redeploying, not a code change. Migrations themselves are additive and
are never part of the kill switch.

### Keep-alive ping

`.github/workflows/keepalive.yml` runs daily (plus manual
`workflow_dispatch`), checking out and running `scripts/ci/keepalive-ping.sh`,
which retries a transient failure automatically and calls
`public.keepalive()` with the publishable key. Two platform facts
explain the schedule and retry margin, and why a scheduled run alone
does not keep the workflow itself alive:

- Supabase pauses a free project after **7 days with no database
  activity** (any PostgREST request counts, and Supabase emails a
  warning first). At the previous twice-a-week schedule, a single
  failed or dropped run could already leave a 7-day gap between
  successful pings -- exactly that pause threshold, with no margin
  left. Daily runs change that: each run also retries a transient
  failure up to 3 times (`curl --retry 3 --retry-all-errors`), so
  several consecutive days of outright failure are needed before a
  7-day gap can open at all.
- GitHub disables a scheduled workflow in a public repository after
  **60 days with no repository activity** -- and a _scheduled_ run does
  not count as that activity; a push does. In other words, this
  workflow keeps Supabase awake, but only real commits to this
  repository keep the _workflow itself_ from eventually being disabled
  (GitHub emails the last editor about 7 days before that happens).

The `KEEPALIVE_STRICT` repository variable and the two repository
secrets combine into one outcome, checked in this order (an invalid
`KEEPALIVE_STRICT` is rejected before the secrets are even looked at):

| `KEEPALIVE_STRICT`                                                  | Secrets         | Result                                                           |
| ------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| invalid (anything but `true`/`false`/unset/empty, case-insensitive) | any             | Red -- the run fails naming the accepted values                  |
| unset, empty, or `false`                                            | both set        | Pings `public.keepalive()`; red only if the request itself fails |
| unset, empty, or `false`                                            | exactly one set | Red -- a partial setup is always a misconfiguration              |
| unset, empty, or `false`                                            | neither set     | Green with a notice (dormant)                                    |
| `true`                                                              | both set        | Pings `public.keepalive()`; red only if the request itself fails |
| `true`                                                              | exactly one set | Red -- a partial setup is always a misconfiguration              |
| `true`                                                              | neither set     | Red                                                              |

In other words, `KEEPALIVE_STRICT` only changes the neither-secret-set
row, from a quiet dormant no-op to a red failure -- it never changes
the exactly-one-secret-set row, which is always red in either mode,
since that combination can only be a misconfiguration and is never
treated as "both missing". While both repository secrets are unset and
`KEEPALIVE_STRICT` is not `true`, every run prints a notice and exits
successfully (dormant). Once the Supabase project exists and both
secrets are set, also set the **`KEEPALIVE_STRICT` repository variable
to `true`** (repository Settings -> Secrets and variables -> Actions ->
Variables tab), so that a secret going missing again -- a partial
setup, or one secret cleared by mistake -- turns the run red instead of
silently falling back to dormant.

Every row of the table above -- including `KEEPALIVE_STRICT=true` with
both secrets set, the everyday production configuration after go-live,
and a whitespace-padded or otherwise invalid value -- is proven by
`npm run test:ci-scripts` (`scripts/ci/__tests__/keepalive-ping.test.mjs`),
which also runs in CI on any change to the script or either workflow
file (`.github/workflows/keepalive-tests.yml`). Its `configuration
validation` tests exercise every `KEEPALIVE_STRICT` value (unset, empty,
`false`, `true`, an invalid value, a whitespace-padded value) with
neither secret set; an invalid value with exactly one secret set,
proving the `KEEPALIVE_STRICT` check runs before the partial-secret
check; an explicitly empty value with exactly one secret set; and an
invalid or whitespace-padded value with both secrets set -- always
asserting that a rejected configuration never makes a request. The
valid values (unset, `false`, and `true`) with both secrets set are
exercised separately, in the `HTTP outcomes` group below. Its
`HTTP outcomes` tests point the script at a local HTTP stub and
cover a 2xx success, a 401 (wrong key) and a 404 (wrong URL) failing
after exactly one request, a 503 that recovers on retry, four straight
503s exhausting the retry budget, and a refused connection -- the
stub's port is closed before the script runs. That is a refused
connection, not a dropped one: the suite has no way to simulate a
connection that is accepted and then silently drops mid-request.

The real signal that keep-alive is working is the **Actions run
history**, not a database read: a failing run shows red in the Actions
tab, and GitHub emails that failure to the workflow's last editor.
`ops_heartbeat.last_ping_at` is not proof that this workflow ran --
`public.keepalive()` is callable by anyone holding the publishable key
(by design: the workflow calls it with no signed-in session at all), so
a third party, or a stray manual call from anywhere else, can keep that
timestamp fresh independently of whether the scheduled job itself is
succeeding. Reading it is a convenience status check, never
confirmation that the workflow ran:

```sql
select last_ping_at from public.ops_heartbeat;
```

There is no admin-facing banner for this yet (a later slice adds one);
run the query above as an admin, or as `postgres` in the SQL editor.

### Checking the scheduled purges

Five pg_cron jobs run on their own schedule (all times UTC), each in its
own transaction so one failing job never blocks the others:

| Job                                | Schedule                     | Does                                                                    |
| ---------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `purge-pending-consent-accounts`   | `17 * * * *` (hourly)        | Deletes accounts that never recorded consent, about 24h after creation  |
| `purge-unconfirmed-email-accounts` | `22 * * * *` (hourly)        | Deletes email sign-ups that never confirmed their address, after 7 days |
| `purge-dormant-accounts`           | `27 * * * *` (hourly)        | Deletes accounts with no sign-in and no payment for 2 years             |
| `purge-expired-confirmations`      | `32 * * * *` (hourly)        | Deletes attendance confirmations 30 days after their class date         |
| `purge-cron-job-run-details`       | `0 4 * * 0` (weekly, Sunday) | Trims `cron.job_run_details` itself, keeping 7 days of run history      |

Check recent runs (as `postgres`, or an admin with SQL editor access):

```sql
select j.jobname, r.status, r.start_time, r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
order by r.start_time desc
limit 20;
```

A failing purge shows `status = 'failed'` on its own row, with the error
in `return_message`, while the other jobs' rows are unaffected.

### Teardown

To abandon the feature entirely: delete the personal data and auth users
with SQL (or through the dashboard), then delete the Supabase project
itself. Stopping the GitHub keep-alive schedule is optional -- pointing
it at a project that no longer exists just means every run fails loudly,
which is itself a correct signal -- but disable or delete the workflow,
and remove the two repository secrets, if that noise is not wanted.
Migrations are additive and version-controlled, so nothing here is lost
by deleting the project; recreating it and pushing them again is enough
to come back. This is separate from stopping the **local** dev stack
(`supabase stop`, see "Bootstrapping" above), which never touches a
hosted project.

## What's here

| Path              | What                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `config.toml`     | Local stack config -- only the settings this project depends on (see the file's own header) |
| `migrations/`     | Schema, RLS, grants, triggers, RPCs, applied in filename order; never contains data         |
| `tests/database/` | pgTAP suite, run by `npm run test:db` and CI (`.github/workflows/db-tests.yml`)             |
| `seed.sql`        | Synthetic local dev data (see above)                                                        |
