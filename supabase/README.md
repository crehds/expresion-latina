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

The local ports are 343xx, not the CLI's 543xx defaults: API
`http://127.0.0.1:34321`, database 34322, Studio `http://127.0.0.1:34323`,
Mailpit `http://127.0.0.1:34324` (`config.toml` explains why). A local
`VITE_SUPABASE_URL` points at `http://127.0.0.1:34321`.

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
  `http://127.0.0.1:34324` with this project's ports; its API lists them at
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
- **Email templates.** `templates/confirmation.html` and
  `templates/recovery.html`, wired in `config.toml` with their Spanish
  subjects, replace the default emails. Their links point at the app's own
  `/auth/confirm` page, built from `{{ .SiteURL }}` and `{{ .TokenHash }}`
  (never `{{ .ConfirmationURL }}`), so the link works in any browser and
  does not depend on the redirect allowlist. The page verifies the token
  only when the member presses a button, so a mail link scanner cannot spend
  it. They promise a link that lasts 1 hour, the default `otp_expiry`
  (3600 s); a test fails if `config.toml` changes it or the templates drift.
  The stack mounts the files when it starts: restart it after editing one.
  The Auth service also limits how often one address can be sent a
  confirmation or reset email (`max_frequency`, 1 second by default).
- **Google is off** until the stack is given a Google OAuth client; until
  then its button ends on an "Unsupported provider" error page. To try it,
  create the client as in "Google sign-in" below, with the local Auth
  callback (`http://127.0.0.1:34321/auth/v1/callback` with this project's ports) as an
  authorized redirect URI. Export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the shell that starts the
  stack, uncomment the two `env(...)` lines of `[auth.external.google]` and
  set `enabled = true`, then restart the stack. Keep those edits out of
  commits.
- **Real sign-up and reset journey.** `npm run test:e2e:auth` drives a real
  sign-up through the local stack, in a browser: it builds the site against
  the stack, signs a new `e2e-auth-<time>@example.test` account up on the
  login page, reads the confirmation email from Mailpit, opens its
  `/auth/confirm` link and presses "Confirmar mi correo", checks that the
  member ends on the home page signed in with the consent recorded in the
  database, and signs in again with the password. Then it asks for a
  password reset from the login page, opens the link of the recovery email,
  presses "Continuar", sets a new password, and checks that the new password
  signs in and the old one does not. Then it drives the admin area. Until the
  account is promoted with SQL the menu has no "Admin" and `/admin/members`
  is the not-found page. Once it is, the journey finds the member in the
  directory and opens their page, records a payment (the start typed, the end
  from "+1 mes", the row in the database equal to what the form showed),
  corrects it to end yesterday so the member turns inactive, has the database
  refuse a payment that overlaps (the real `23P01`), corrects and deletes a
  payment that was deleted with SQL behind the page's back (the real answer
  of no row matched), and deletes the last one with its two-step
  confirmation. It also checks the keep-alive notice against the heartbeat:
  one that is four days old shows it, `public.keepalive()` takes it away, and
  an empty table shows the "no ping" message. The build is pinned to
  `VITE_KEEPALIVE_ALERT_DAYS=3`, so a local env file cannot change that. Last
  it drives the account page: the menu shows "Mi cuenta" and no "Ingresar",
  the page shows the name, the email and the consent on record, "Cerrar
  sesión" brings "Ingresar" back, a new sign-in reaches the page again, and
  "Eliminar mi cuenta" erases the auth user and its profile (checked in the
  database) so that account can no longer sign in. It deletes the account
  (its payments go with it) and its emails afterwards (if the journey did
  not already), and puts `public.ops_heartbeat` back as it found it, the row
  it had to the microsecond or no row, whether it passes or not. It needs the
  stack running (see "Bootstrapping") and port 3000 free, and it is not part
  of `npm run test:e2e` or of CI, which has no stack.

### Manual checklist (Mailpit)

`npm run test:e2e:auth` is the automated version of the first four steps and
of the last one. Run this by hand after changing an email template, the Auth
settings in `config.toml` or the account pages. Start the stack and the app
(`npm run dev`, with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
pointing at it), and keep Mailpit open (`http://127.0.0.1:34324`).

1. **Sign-up confirmation.** On `/login` press "Crear cuenta", fill the form,
   tick the privacy checkbox and submit. Expect: the message "Te enviamos un
   correo para confirmar tu cuenta." In Mailpit, one email with the subject
   "Confirma tu cuenta de Expresión Latina" whose link starts with
   `http://localhost:3000/auth/confirm?token_hash=`. Open it: the page shows
   "Confirmar correo" and nothing is verified yet (no session is stored). Press
   "Confirmar mi correo": you land on the home page signed in, the menu shows
   "Mi cuenta", and no consent screen appears.
2. **Used or expired link.** Open the same link again and press the button.
   Expect: "El enlace venció o ya se usó." and the form "Reenviar correo de
   confirmación".
3. **Resend.** Sign up with a second address, do not confirm it, then open the
   expired-link page or try to sign in. Press "Reenviar correo de confirmación"
   and expect "Si tu cuenta está pendiente de confirmación, te enviamos un
   nuevo correo." plus a new email in Mailpit. For an address that never
   signed up the message is the same, and no email arrives.
4. **Password reset.** On `/login` press "¿Olvidaste tu contraseña?", type the
   email and press "Enviar enlace". Expect "Si existe una cuenta con ese
   correo, te enviamos un enlace para restablecer tu contraseña." (the same
   text for an unknown address, with no email) and an email with the subject
   "Restablece tu contraseña de Expresión Latina". Open its link, press
   "Continuar", and set a new password twice: "Tu contraseña se actualizó."
   The old password no longer signs in, the new one does. A used or expired
   recovery link shows "El enlace venció o ya se usó." with "Pedir un enlace
   nuevo".
5. **Other devices.** Sign in on two browsers, change the password in one
   from `/account` ("Cambiar contraseña"). Expect "Tu contraseña se
   actualizó." there, and the other browser to be signed out the next time it
   refreshes its session.
6. **Sign out.** On `/account` press "Cerrar sesión": you go to the home page
   and the menu shows "Ingresar". The other browser stays signed in.
7. **Account deletion.** On `/account` press "Eliminar mi cuenta", then "Cancelar"
   (nothing changes), then again "Eliminar mi cuenta" and "Sí, eliminar mi
   cuenta". Expect "Tu cuenta fue eliminada." with a single link "Ir al
   inicio" (not the login page). In the database the `auth.users` row and
   its `public.profiles` row are gone, and signing in with that account
   answers "Correo o contraseña incorrectos."

### Manual checklist (admin area)

The admin leg of `npm run test:e2e:auth` runs all of this against the real
stack. Do it by hand after changing the admin pages, the payments or the
keep-alive notice, or to see them with your own eyes. Start the stack and the
app as above and sign a member up through the app (any address, confirmed
through Mailpit), so there is someone to find. Run the SQL in the SQL editor
of Studio (`http://127.0.0.1:34323`).

1. **Make the member an administrator.** Until then the menu has no "Admin"
   and `/admin/members` shows "No encontramos esta página". Promote the
   account as in "Email sign-up requires a consent version", then reload the
   page (the profile loads once per session): the menu shows "Admin".
2. **Find the member.** "Admin" opens the directory. Type the email, press
   "Buscar" ("1 miembro") and open the name. The page of the member shows
   "Inactivo" and "Sin pagos registrados".
3. **Record a payment.** Press "Registrar pago", type a start a few days ago,
   press "+1 mes" (the end appears, and can still be edited) and "Guardar".
   Expect "Activo" and "Pagado hasta" the end you saw in the form.
4. **Correct it.** Press "Editar" on the payment, move the end to yesterday
   and "Guardar". Expect "Inactivo" and "Último vencimiento" with yesterday.
5. **Overlap.** Record a payment whose dates overlap the first one. Expect
   "Esas fechas se cruzan con otro pago de este miembro. Cambia las fechas e
   inténtalo de nuevo." and nothing new in the list.
6. **A payment that is gone.** Record another payment and delete its row with
   SQL (`delete from public.paid_periods where ...`). The page still shows
   it: press "Editar", change the end and "Guardar" (or "Eliminar" and "Sí,
   eliminar el pago"). Expect "Este pago ya no existe. Mostramos la lista al
   día." and the list without it.
7. **Delete.** "Eliminar" on the last payment asks "¿Eliminar este pago? Esta
   acción no se puede deshacer."; "Cancelar" changes nothing, and "Sí,
   eliminar el pago" removes it. Expect "Todavía no hay pagos registrados."
8. **The keep-alive notice.** The heartbeat is the project's, so note its
   value first (an empty result means the table has no row):

   ```sql
   select last_ping_at from public.ops_heartbeat;
   ```

   Then change it and reload any admin page after each statement:

   ```sql
   -- "El último ping de mantenimiento registrado fue el ..., hace 4 días. ..."
   insert into public.ops_heartbeat (id, last_ping_at)
   values (1, now() - interval '4 days')
   on conflict (id) do update set last_ping_at = excluded.last_ping_at;

   -- no notice
   select public.keepalive();

   -- "Todavía no hay ningún ping de mantenimiento registrado. ..."
   delete from public.ops_heartbeat;
   ```

   Put the heartbeat back as you found it: the insert above with the value you
   noted instead of `now() - interval '4 days'`, or nothing more if the table
   was empty. With `VITE_KEEPALIVE_ALERT_DAYS=off` in the environment of the
   app (restart `npm run dev` after changing it) no notice appears, whatever
   the table holds.

9. **Clean up.** Delete the test member
   (`delete from auth.users where email = '...'`): their profile and their
   payments go with it.

### Manual checklist (attendance on the schedule)

The member leg of `npm run test:e2e:auth` runs these steps against the real
stack, except two that only unit tests cover
(`src/pages/Schedules/Schedules.attendance.test.jsx`): the signed-out page in
step 1 and the rehearsal in step 2. Do it by hand after changing the attendance
controls, the schedule page
or the `attendance_confirmations` table. Start the stack and the app as above and
sign a member up through the app, and do not make them an administrator (an
administrator's policies read everyone's rows, which hides a missing filter).
Open `/schedules` on a wide window and look at the first class of a weekday that
is not today (in Lima). Run the SQL in the SQL editor of Studio.

1. **No payment.** The class says "Tu membresía no está activa." with the link
   "Escríbenos por WhatsApp", and no class has a "Confirmar asistencia" button.
   Signed out, the page is the same as ever: no message and no button.
2. **Record a payment** that covers today and the next month, and reload:

   ```sql
   insert into public.paid_periods (member_id, starts_on, ends_on)
   select id, private.lima_today(), private.lima_today() + 30
   from auth.users where email = '...';
   ```

   The class shows "Próxima clase: ..." with its date and "Confirmar asistencia".
   A rehearsal ("Ensayo Elenco") shows neither a button nor a message.

3. **Confirm.** Press "Confirmar asistencia": "Confirmaste tu asistencia." and
   "Cancelar asistencia". In the database there is one row, its times are written
   with seconds and its `starts_at` is in the future:

   ```sql
   select start_time::text, end_time::text, starts_at > now()
   from public.attendance_confirmations;
   ```

4. **Reload.** The class still says "Cancelar asistencia". If it offers
   "Confirmar asistencia" again, the page did not read the 'HH:MM:SS' times back.
5. **Cancel.** Press "Cancelar asistencia": the button goes back to "Confirmar
   asistencia" and the table has no row.
6. **Shorten the payment** to end today and reload:

   ```sql
   update public.paid_periods set ends_on = private.lima_today()
   where member_id = (select id from auth.users where email = '...');
   ```

   A class of another day says "Tu membresía vence el ..." with today, and has
   no button.

7. **Delete the payment** and reload: "Tu membresía no está activa." again.
8. **Clean up.** Delete the test member
   (`delete from auth.users where email = '...'`): their profile, payments and
   confirmations go with it.

### Manual checklist (admin attendance)

The admin attendance leg of `npm run test:e2e:auth` runs these steps against the
real stack. Do it by hand after changing the attendee list
(`src/pages/Admin/AdminAttendance.jsx`), `listUpcomingConfirmations` or the
`attendance_confirmations` table, or to see it with your own eyes. Start the
stack and the app as above, sign a member up through the app and make them an
administrator (step 1 of "Manual checklist (admin area)"). Run the SQL in the SQL
editor of Studio. The test member is the member and the administrator at once, so
every row of the list is theirs: that an administrator reads the rows of every
member is proven by the database tests (`npm run test:db`), not by this
checklist.

1. **Confirm a class.** Take the first class of a weekday that is not today (in
   Lima) from `src/data/academy.json`: its start and end, its genre (id and name)
   and its room. The room key is the slug of the room (`Sala 1` is `sala-1`).
   Confirm it for the member on the date of that weekday within the next seven
   days:

   ```sql
   insert into public.attendance_confirmations
     (member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
   select id, '<date>', '<start>', '<end>', '<genre id>', '<room key>', '<genre name>', '<room>'
   from auth.users where email = '...';
   ```

2. **Open the list.** "Admin", then "Asistencia" in the sub-navigation. Under the
   name of the class there is its date, times and room (for example "26 de
   octubre de 2026 · 18:00 a 19:00 · Sala 1", with the times as HH:MM although the
   database prints HH:MM:SS) and the name of the member, and no email anywhere.
   In the network tab the page asks `attendance_confirmations` once, with
   `class_date=gte.<today>` and `class_date=lte.<today + 7 days>`,
   `order=id.asc`, `limit=500` and `profiles(full_name)` in `select`, and with no
   filter on `member_id` and none on `id`.
3. **A confirmation that matches no class.** Add one for the same genre and room
   at a time the schedule does not have, two days ahead, and reload:

   ```sql
   insert into public.attendance_confirmations
     (member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
   select id, private.lima_today() + 2, '23:30', '23:45',
     '<genre id>', '<room key>', '<genre name>', '<room>'
   from auth.users where email = '...';
   ```

   The section "Ya no coincide con el horario" shows it with the name of the
   member, the name of the class and its date, times and room. The class above
   still lists the member.

4. **More than a page.** Add 520 confirmations for a made-up genre and reload:

   ```sql
   insert into public.attendance_confirmations
     (member_id, class_date, start_time, end_time, genre_id, room_key, genre_name, room_label)
   select u.id, private.lima_today() + 3, time '00:00' + n * interval '1 minute',
     time '00:01' + n * interval '1 minute', 'e2e-relleno', 'sala-1', 'Relleno E2E', 'Sala 1'
   from auth.users u, generate_series(0, 519) as n
   where u.email = '...';
   ```

   The network tab shows two requests to `attendance_confirmations`, both with
   `order=id.asc` and `limit=500`. The first answers 500 rows. The second has
   `id=gt.<the id of the last row of the first answer>` and answers the rest. The
   section "Ya no coincide con el horario" lists all of them, and no alert shows.

5. **Stop being an administrator** and load `/admin/attendance` again:

   ```sql
   update public.profiles set is_admin = false
   where id = (select id from auth.users where email = '...');
   ```

   The page says "No encontramos esta página", the menu has no "Admin" and the
   network tab shows no request to `attendance_confirmations`.

6. **Clean up.** Delete the test member
   (`delete from auth.users where email = '...'`): their profile, payments and
   confirmations go with it.

Only unit tests cover the rest of the page
(`src/pages/Admin/AdminAttendance.test.jsx`,
`src/features/attendance/ui/*.test.jsx`,
`src/features/attendance/adapters/attendanceAdapter.test.js` and
`src/App.test.jsx`):

- the empty list ("Nadie ha confirmado todavía.");
- a failed read ("No pudimos cargar las confirmaciones de asistencia." with
  "Reintentar");
- the degraded state ("No pudimos comparar las confirmaciones con el horario
  actual.", with the list grouped by class and no mismatch section). A time with
  seconds cannot be inserted with SQL (the whole-minute checks of the table refuse
  it), so only a faked adapter reaches that state;
- a confirmation that appears or goes between two pages;
- the order of the names, the count of each class and "Miembro sin nombre" for a
  member whose profile does not come with the confirmation;
- the sub-navigation and the "Admin" entry of the menu being marked on this page.

## Production runbook

Everything below is for when the owner is ready to run this feature
against a real, hosted Supabase project instead of the local stack. None
of it runs automatically -- every step is a manual dashboard action or
an explicitly authorized `supabase link` / `supabase db push`, never
something this repository's own scripts do on their own.

Rough order: create the Supabase project, push these migrations, sign up
once and promote yourself to admin (see "Email sign-up requires a
consent version" above), configure SMTP and the email rate limit,
configure Google sign-in, paste the email templates and set the Site URL
(both required, see "Hosted email templates"), set the redirect allowlist, set the environment
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

### Hosted email templates

**Required activation step. Do not activate the feature without it.** The
templates in `templates/` only reach the local stack. A hosted project
keeps its own copy, so paste them in by hand, and set the Site URL and the
Redirect URLs, or the account flows break for real members:

- Without the **Reset password** template, Supabase sends its default
  English reset email, whose link lands on `/` with no new-password form.
  The member cannot choose a new password, and the app has no fallback for
  that.
- Without the **Confirm sign up** template, the default confirmation link
  only works in the same browser that started the sign-up, so a member who
  opens the email on a phone, or in another browser, is not confirmed.
- Without the right Site URL and Redirect URLs, the links in the templates
  point to the wrong place or are refused.

1. Supabase Dashboard -> **Authentication -> Emails -> Templates**. For
   **Confirm sign up**, set the subject to
   `Confirma tu cuenta de Expresión Latina` and the body to the contents of
   `templates/confirmation.html`. For **Reset password**, set the subject to
   `Restablece tu contraseña de Expresión Latina` and the body to
   `templates/recovery.html`.
2. Supabase Dashboard -> **Authentication -> URL Configuration**: set the
   **Site URL** to the production origin (for example
   `https://www.example.com`, no trailing slash). The templates build their
   links from it, so a wrong Site URL sends members to the wrong place. Add
   the production origin to **Redirect URLs** too (see "Redirect
   allowlist" below).
3. Leave the email link lifetime (the email OTP expiration of the Auth
   settings) at its default of 3600 seconds: the templates tell members
   the link lasts 1 hour.

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

Before setting them in Production, replace the two bracketed placeholders
of the privacy notice (`CONTROLLER` and `CONTACT` in
`src/features/accounts/domain/privacyContacts.js`): a Vercel production
build (`VERCEL_ENV=production`, which Vercel sets at build time while
"Automatically expose System Environment Variables" is on) that has both
variables and a placeholder fails with a message naming that file. Local,
preview and backend-off builds are not affected.

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

Run the query above as an admin, or as `postgres` in the SQL editor.

An administrator who opens the admin area (`/admin/members` and the pages
under it) also sees a notice above the page when the last ping is old. It
reads `ops_heartbeat.last_ping_at` once, when the area opens, and says one of
two things: that no ping is recorded yet, or the date of the last one (on the
Lima calendar) and how many days ago it was. A recent ping shows nothing, and
so does a heartbeat that cannot be read. The notice only reports what is
recorded and points to the run history of the "Keep-alive ping" workflow in
GitHub Actions, which stays the real signal for the reason above: the
timestamp alone does not prove that the workflow ran.

The notice appears when the last ping is more than **3 days** old (the
workflow runs daily). Change that per environment with the build-time
variable `VITE_KEEPALIVE_ALERT_DAYS`, set where the other `VITE_` variables
are set (the Vercel environment of a deployment). It is optional, and it only
matters where the feature is on:

- Unset or empty: 3 days.
- A whole number of days of 1 or more, in digits only (`7`): that many days.
- `off`, in any case and with nothing around it: no notice, and the heartbeat
  is not even read.

Anything else fails `vite build`, whether the backend is on or off, with a
message that names the variable and the accepted forms. That includes `0`, a
sign (`+3`, `-1`), a leading zero (`03`), a decimal (`3.5`), an exponent
(`1e2`), a space before or after the number, a unit (`3d`) and a number too
large to be exact. Like the other `VITE_` variables it is written into the
bundle at build time, so changing it means building again. In `npm run dev`
and in the tests nothing refuses a malformed value, and it counts as 3 days.

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
