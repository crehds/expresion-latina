/*
 * Drives a real sign-up and a real password reset through the local Supabase
 * stack, in a real browser.
 *
 * The unit tests fake the backend, and the CSP check fakes its origin, so
 * neither proves that what the app sends is what Supabase Auth accepts. This
 * does: it builds the site against the local stack, opens the login page, signs
 * a new account up, reads the confirmation email from Mailpit, opens its
 * /auth/confirm link, presses "Confirmar mi correo", and checks that the member
 * ends on the home page signed in with no consent screen, and that the profile
 * recorded the consent of the current notice version. It opens the same link
 * again to see the real "expired or already used" answer and the resend form.
 * It then signs in again with the password, once with a wrong one, to see the
 * real "wrong credentials" answer map to its message. Last, the reset leg: it
 * asks for a reset from the login page, opens the link of the recovery email,
 * presses "Continuar", sets a new password, and checks that the new password
 * signs in and the old one does not. Then the member leg, while the member is
 * still no administrator: the public schedule shows the inactive message and the
 * WhatsApp link with no payment; with one recorded with SQL a class offers
 * "Confirmar asistencia" and, once confirmed, "Cancelar asistencia" (the row holds
 * the times as HH:MM:SS and a future starts_at, and a reload still shows
 * "Cancelar", which proves the page reads those times back as HH:MM); cancelling
 * leaves no row; a payment that ends today makes a class of another day say
 * "Tu membresía vence el"; deleting it brings the inactive message back. Then the
 * admin leg, before the account is deleted: while the member is no administrator
 * the menu has no "Admin" and /admin/members is the not-found page; the account
 * is promoted with SQL, the page is reloaded (the profile loads once per
 * session), and the menu opens the directory, where the member is searched by
 * email and their page opened. There a payment is recorded (the start typed,
 * the end from "+1 mes", and the row in the database equal to what the form
 * showed), corrected to end yesterday, which makes the member inactive, and
 * refused when it overlaps (the real 23P01, read off the response). A payment
 * deleted with SQL behind the page's back is then corrected, and another one
 * deleted, to see the real answer of no row matched (NOT_FOUND) twice; the last
 * payment is deleted with its two-step confirmation.
 * Last, the keep-alive notice: a heartbeat four days old shows it,
 * `public.keepalive()` takes it away, and no row at all shows the "no ping" one.
 * Then the account leg: the menu offers "Mi cuenta" and no "Ingresar", the
 * account page shows the name, the email and the consent on record, "Cerrar
 * sesión" brings "Ingresar" back, a new sign-in reaches the page again, and
 * "Eliminar mi cuenta" erases the auth user and its profile, after which that
 * account can no longer sign in. A `securitypolicyviolation` anywhere in the
 * journey is a failure.
 *
 * The page is served on port 3000 and browsed as http://localhost:3000, never
 * 127.0.0.1: supabase/config.toml names that origin as the site URL and in the
 * redirect allowlist, and the PKCE verifier lives in the origin the callback
 * returns to. Requests to any other origin (Google Fonts, the map) are aborted.
 *
 * It needs the local stack (Docker) and, unlike the other checks, is not part
 * of `npm run test:e2e` or of CI. It creates one account, e2e-auth-<time>@
 * example.test, and removes it again, with its profile, its payments and its
 * email, whether the journey passes or not (the account leg deletes it itself;
 * the cleanup then finds nothing left to remove). The admin leg also changes
 * `public.ops_heartbeat`, which belongs to the project: its row is saved before
 * the first change and put back exactly by the cleanup (removed if there was
 * none). The build is pinned to VITE_KEEPALIVE_ALERT_DAYS=3, so a local env file
 * cannot change what the notice does.
 *
 * Usage: npm run test:e2e:auth
 */
// The callbacks given to context.addInitScript and page.evaluate run in the page.
/* eslint-env browser */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
// The import resolver cannot follow vite's package.json "exports" map, the
// same limitation vite.config.js already carries this same rule off for.
// eslint-disable-next-line import/no-unresolved
import { build, preview } from 'vite';

import { SUPABASE_CLI } from '../db/test-db-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// These mirror the explicit ports of supabase/config.toml: [api] port for the
// API and [local_smtp] port for Mailpit. Change them together.
const API_URL = 'http://127.0.0.1:34321';
const MAILPIT_URL = 'http://127.0.0.1:34324';
// supabase_db_<project_id>; the project_id is in supabase/config.toml.
const DB_CONTAINER = 'supabase_db_expresion-latina';

// The site URL and the redirect allowlist of supabase/config.toml.
const PORT = 3000;
const SITE = `http://localhost:${PORT}`;

// supabase-js keeps the session under sb-<first label of the API host>-auth-token
// (src/shared/backend/client.js). For 127.0.0.1 that label is "127".
const STORAGE_KEY = `sb-${new URL(API_URL).hostname.split('.')[0]}-auth-token`;

const NOTICE_VERSION = readFileSync(
  resolve(repoRoot, 'src/features/accounts/domain/noticeVersion.js'),
  'utf8',
).match(/CURRENT_NOTICE_VERSION = '([^']+)'/)?.[1];

const STEP_TIMEOUT = 30000;
const EMAIL = `e2e-auth-${Date.now()}@example.test`;
const NAME = 'Prueba E2E';
const PASSWORD = 'abcdefg1';
const NEW_PASSWORD = 'abcdefg2';
const WRONG_PASSWORD = 'otraclave1';

// The subjects of the two templates in supabase/config.toml.
const CONFIRMATION_SUBJECT = 'Confirma tu cuenta de Expresión Latina';
const RECOVERY_SUBJECT = 'Restablece tu contraseña de Expresión Latina';

async function isUp(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

// Whether something already listens on the port, on either loopback address.
// vite's strictPort only sees the address the preview binds to, and the browser
// would try the other one for "localhost" and land on that other server.
function portIsBusy(port) {
  const answers = (host) => new Promise((settle) => {
    const socket = connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      settle(true);
    });
    socket.once('error', () => settle(false));
  });
  return Promise.all([answers('127.0.0.1'), answers('::1')]).then((busy) => busy.some(Boolean));
}

// The key is public by design but is still not printed: nothing here needs to.
function readPublishableKey() {
  // A single command string and no argument list: Windows needs a shell to run
  // npx, and every part of it is a constant of this file.
  const result = spawnSync(`npx --yes ${SUPABASE_CLI} status -o json`, {
    shell: true,
    encoding: 'utf8',
  });
  const key = result.status === 0 ? JSON.parse(result.stdout).PUBLISHABLE_KEY : null;
  assert.ok(key, 'no pude leer la clave publicable del stack local con "supabase status"');
  return key;
}

function psql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`psql falló: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result.stdout.trim();
}

async function mailpit(path, init) {
  const response = await fetch(`${MAILPIT_URL}${path}`, init);
  assert.ok(response.ok, `Mailpit respondió ${response.status} a ${path}`);
  return response;
}

async function messagesTo(address) {
  const { messages } = await (await mailpit('/api/v1/messages?limit=200')).json();
  return messages.filter(
    (message) => message.To.some((to) => to.Address.toLowerCase() === address),
  );
}

// The link of the email with this subject: the app's own confirmation page with
// the token hash, built by the template from the site URL.
async function waitForEmailLink(address, subject, type) {
  const deadline = Date.now() + STEP_TIMEOUT;
  while (Date.now() < deadline) {
    const message = (await messagesTo(address)).find((candidate) => candidate.Subject === subject);
    if (message) {
      const { HTML: html } = await (await mailpit(`/api/v1/message/${message.ID}`)).json();
      const link = /href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(html)?.[1]?.replaceAll('&amp;', '&');
      assert.ok(link, `el correo "${subject}" no trae el enlace a /auth/confirm`);
      assert.ok(
        link.startsWith(`${SITE}/auth/confirm?token_hash=`) && link.endsWith(`&type=${type}`),
        `el enlace del correo "${subject}" no tiene la forma esperada`,
      );
      return link;
    }
    await sleep(300);
  }
  throw new Error(`el correo "${subject}" no llegó a Mailpit en ${STEP_TIMEOUT / 1000} segundos`);
}

// What the page shows in its alerts, for a failure message that says why.
async function visibleAlerts(page) {
  const alerts = await page.getByRole('alert').allTextContents();
  return alerts.length ? ` (la página muestra: "${alerts.join('" / "')}")` : '';
}

// Succeeding ends on the home page; if it does not, say where it stopped.
async function expectHome(page, step) {
  try {
    await page.waitForURL(`${SITE}/`);
  } catch {
    const where = new URL(page.url()).pathname;
    throw new Error(
      `${step} no terminó en la página de inicio, sino en ${where}${await visibleAlerts(page)}`,
    );
  }
}

async function signedInAs(page, address) {
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  assert.ok(stored, 'no quedó una sesión guardada en el navegador');
  assert.equal(JSON.parse(stored).user.email, address, 'la sesión guardada es de otra cuenta');
}

// The journey navigates (to the confirmation link and back, and to the login
// page again), and a global in the page is lost at every navigation. So the
// violations are handed to Node as they happen.
async function openContext(browser, violations, problems) {
  const context = await browser.newContext();
  await context.exposeFunction('reportCspViolation', (text) => violations.push(text));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.reportCspViolation(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  const allowed = [new URL(SITE).origin, new URL(API_URL).origin];
  await context.route((url) => !allowed.includes(url.origin), (request) => request.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy/i.test(message.text())) {
      problems.push(`error de consola sobre la política: ${message.text()}`);
    }
  });
  return { context, page };
}

async function signUp(page) {
  console.log('Abriendo la página de ingreso...');
  const settings = page.waitForResponse(`${API_URL}/auth/v1/settings`);
  // If the page never opens, this must not surface later as an unhandled rejection.
  settings.catch(() => {});
  await page.goto(`${SITE}/login`);
  await page.getByRole('heading', { level: 1, name: 'Ingresar' }).waitFor();
  assert.equal((await settings).status(), 200, 'el stack no contestó los ajustes de Auth');
  await page.waitForLoadState('networkidle');
  assert.equal(
    await page.getByRole('button', { name: 'Continuar con Google' }).count(),
    0,
    'el botón de Google no debería verse: el stack local tiene Google apagado',
  );

  console.log(`Creando la cuenta ${EMAIL}...`);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre completo').fill(NAME);
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Leí y acepto/ }).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  try {
    await page.getByRole('status').filter({ hasText: 'Te enviamos un correo' }).waitFor();
  } catch {
    throw new Error(`no apareció el aviso de que se envió el correo${await visibleAlerts(page)}`);
  }
}

async function confirmByEmail(page) {
  console.log('Esperando el correo de confirmación en Mailpit...');
  const link = await waitForEmailLink(EMAIL, CONFIRMATION_SUBJECT, 'email');

  console.log('Abriendo el enlace de confirmación: no debe verificarse hasta pulsar el botón...');
  await page.goto(link);
  await page.getByRole('heading', { level: 1, name: 'Confirmar correo' }).waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    null,
    'abrir el enlace ya inició sesión: debería esperar al botón',
  );
  await page.getByRole('button', { name: 'Confirmar mi correo' }).click();
  await expectHome(page, 'la confirmación del correo');
  await page.waitForLoadState('networkidle');
  assert.equal(
    await page.getByRole('heading', { name: 'Necesitamos tu consentimiento' }).count(),
    0,
    'la página pidió el consentimiento otra vez',
  );
  await signedInAs(page, EMAIL);

  console.log('Comprobando el consentimiento guardado en la base...');
  const consent = psql(
    "select p.consent_version || '|' || (p.consent_at is not null)::text "
    + 'from public.profiles p join auth.users u on u.id = p.id '
    + `where u.email = '${EMAIL}'`,
  );
  assert.equal(consent, `${NOTICE_VERSION}|true`, 'el perfil no guardó la versión del aviso y la hora');

  console.log('Abriendo el mismo enlace otra vez: ya se usó...');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto(link);
  await page.getByRole('button', { name: 'Confirmar mi correo' }).click();
  await page.getByRole('alert').filter({ hasText: 'El enlace venció o ya se usó.' }).waitFor();
  await page.getByRole('button', { name: 'Reenviar correo de confirmación' }).waitFor();
}

async function signInAgain(page) {
  console.log('Ingresando de nuevo con la contraseña (primero una equivocada)...');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto(`${SITE}/login`);
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(WRONG_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos.' }).waitFor();

  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expectHome(page, 'el ingreso con la contraseña');
  await signedInAs(page, EMAIL);
}

async function resetPassword(page) {
  console.log('Pidiendo el enlace para restablecer la contraseña...');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto(`${SITE}/login`);
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }).waitFor();
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  try {
    await page.getByRole('status').filter({ hasText: 'Si existe una cuenta con ese correo' }).waitFor();
  } catch {
    throw new Error(`no apareció el aviso del enlace enviado${await visibleAlerts(page)}`);
  }

  console.log('Esperando el correo de recuperación en Mailpit...');
  const link = await waitForEmailLink(EMAIL, RECOVERY_SUBJECT, 'recovery');

  console.log('Abriendo el enlace de recuperación y pulsando "Continuar"...');
  await page.goto(link);
  await page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }).waitFor();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  try {
    await page.getByRole('status').filter({ hasText: 'Tu contraseña se actualizó.' }).waitFor();
  } catch {
    throw new Error(`no apareció el aviso de la contraseña cambiada${await visibleAlerts(page)}`);
  }
  await signedInAs(page, EMAIL);

  console.log('Cerrando la sesión y probando la contraseña vieja y la nueva...');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto(`${SITE}/login`);
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos.' }).waitFor();

  await page.getByLabel('Contraseña', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expectHome(page, 'el ingreso con la contraseña nueva');
  await signedInAs(page, EMAIL);
}

// The signed-in member's menu, which in a desktop-wide window is the inline bar.
const mainMenu = (page) => page.getByRole('navigation', { name: 'Principal' });

// A calendar day is no instant. The dates of the payments are 'YYYY-MM-DD'
// strings worked out in UTC, never through new Date('YYYY-MM-DD') (midnight in
// the zone of this machine) and never through SQL interval math, which clamps at
// the end of a month in ways the app has its own rule for. Only "today" comes
// from the database, on the Lima calendar, the way the app counts it.
function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const LONG_DATE = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });

// How the page writes a day: "19 de octubre de 2026".
function longDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return LONG_DATE.format(new Date(Date.UTC(year, month - 1, day)));
}

const rangeText = (startsOn, endsOn) => `Del ${longDate(startsOn)} al ${longDate(endsOn)}`;

// The payments of a member as the database holds them: "start|end" for each,
// oldest first, joined by commas.
const periodsOf = (userId) => psql(
  "select coalesce(string_agg(starts_on::text || '|' || ends_on::text, ',' order by starts_on), '') "
  + `from public.paid_periods where member_id = '${userId}'`,
);

// public.ops_heartbeat belongs to the project, not to this run, and the notice
// leg has to change it. Its one row is saved before the first change (null: not
// touched yet; '': there was no row) and put back by the cleanup.
let savedHeartbeat = null;
const heartbeatNow = () => psql(
  "select coalesce((select last_ping_at::text from public.ops_heartbeat where id = 1), '')",
);

// Polls a count: the page needs a moment to show what was just saved.
async function expectCount(locator, expected, message) {
  const deadline = Date.now() + STEP_TIMEOUT;
  let count = await locator.count();
  while (count !== expected && Date.now() < deadline) {
    await sleep(200);
    count = await locator.count();
  }
  assert.equal(count, expected, message);
}

const paymentRows = (page) => page
  .getByRole('region', { name: 'Pagos registrados' })
  .getByRole('listitem');

// The first request of this kind that the page sends from now on.
const nextRequest = (page, method, table) => {
  const answer = page.waitForResponse(
    (response) => response.url().includes(`/rest/v1/${table}`)
      && response.request().method() === method,
  );
  // If nothing is ever sent, this must not surface later as an unhandled rejection.
  answer.catch(() => {});
  return answer;
};

// The group of shortcuts for the end is labelled "Atajos para la fecha de fin",
// so the fields are found by their exact label.
const startsOnField = (page) => page.getByLabel('Fecha de inicio', { exact: true });
const endsOnField = (page) => page.getByLabel('Fecha de fin', { exact: true });

async function openPaymentForm(page) {
  await page.getByRole('button', { name: 'Registrar pago', exact: true }).click();
  await page.getByRole('form', { name: 'Registrar pago' }).waitFor();
}

// A form that saved goes away once the page has read the member again; one that
// was refused stays, with its message.
async function saveAndClose(page, formName, step) {
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  try {
    await page.getByRole('form', { name: formName }).waitFor({ state: 'detached' });
  } catch {
    throw new Error(`${step} no cerró el formulario${await visibleAlerts(page)}`);
  }
}

// Records a payment with both dates typed, and returns once the form is gone.
async function recordPayment(page, startsOn, endsOn, step) {
  await openPaymentForm(page);
  await startsOnField(page).fill(startsOn);
  await endsOnField(page).fill(endsOn);
  await saveAndClose(page, 'Registrar pago', step);
  await page.getByText(rangeText(startsOn, endsOn), { exact: true }).waitFor();
}

const paymentGone = (page) => page
  .getByRole('alert')
  .filter({ hasText: 'Este pago ya no existe. Mostramos la lista al día.' });

// What the member is told when the payment they act on has been deleted behind
// the page's back: the page is still showing it, and the database answers that
// no row matched. The notice stays, the list is read again without the row, and
// the form or the question that found out is gone.
async function expectPaymentGone(page, answer, gone, step) {
  const response = await answer;
  assert.equal(response.status(), 200, `${step}: la base no contestó con un 200`);
  assert.deepEqual(await response.json(), [], `${step}: la base debía contestar que ninguna fila coincidió`);
  try {
    await paymentGone(page).waitFor();
  } catch {
    throw new Error(`${step}: no apareció el aviso de que el pago ya no existe${await visibleAlerts(page)}`);
  }
  await page.getByText(gone, { exact: true }).waitFor({ state: 'detached' });
}

// Before the account is promoted, and the promotion itself.
async function adminAccess(page) {
  console.log('Comprobando que un miembro que no es administrador no ve la administración...');
  await mainMenu(page).getByRole('link', { name: 'Mi cuenta' }).waitFor();
  assert.equal(
    await mainMenu(page).getByRole('link', { name: 'Admin', exact: true }).count(),
    0,
    'el menú ofrece "Admin" a un miembro que no es administrador',
  );
  await page.goto(`${SITE}/admin/members`);
  await page.getByRole('heading', { level: 1, name: 'No encontramos esta página' }).waitFor();
  assert.equal(
    await page.getByRole('heading', { level: 1, name: 'Administración' }).count(),
    0,
    'la administración se mostró a un miembro que no es administrador',
  );

  console.log('Haciendo administrador a ese miembro con SQL y recargando la página...');
  const userIdSql = `(select id from auth.users where email = '${EMAIL}')`;
  psql(`update public.profiles set is_admin = true where id = ${userIdSql}`);
  assert.equal(
    psql(`select is_admin::text from public.profiles where id = ${userIdSql}`),
    'true',
    'la base no marcó a la cuenta de prueba como administradora',
  );
  // The profile loads once per session, so the page learns of it on a reload.
  await page.reload();
  await page.getByRole('heading', { level: 1, name: 'Administración' }).waitFor();
  await mainMenu(page).getByRole('link', { name: 'Admin', exact: true }).waitFor();
}

// From the menu to the page of the member.
async function adminMemberPage(page, userId) {
  console.log('Abriendo el directorio desde el menú, buscando a la cuenta y abriendo su página...');
  await mainMenu(page).getByRole('link', { name: 'Inicio', exact: true }).click();
  await expectHome(page, 'la vuelta al inicio con el menú de administrador');
  await mainMenu(page).getByRole('link', { name: 'Admin', exact: true }).click();
  await page.waitForURL(`${SITE}/admin/members`);
  await page.getByRole('heading', { level: 2, name: 'Miembros' }).waitFor();

  await page.getByLabel('Buscar por nombre o correo').fill(EMAIL);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /^1 miembro$/ }).waitFor();
  await page.getByRole('link', { name: NAME, exact: true }).click();
  await page.waitForURL(`${SITE}/admin/members/${userId}`);
  await page.getByRole('heading', { level: 2, name: NAME }).waitFor();
  await page.getByText(EMAIL, { exact: true }).waitFor();
  await page.getByText('Inactivo', { exact: true }).waitFor();
  await page.getByText('Sin pagos registrados', { exact: true }).waitFor();
  await page.getByText('Todavía no hay pagos registrados.', { exact: true }).waitFor();
}

// Record, correct, refuse an overlap, find a payment gone twice, delete.
async function adminPayments(page, userId) {
  const today = psql("select (now() at time zone 'America/Lima')::date::text");
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'no pude leer la fecha de hoy de la base');
  const yesterday = addDays(today, -1);

  console.log('Registrando un pago que empieza hace cinco días y termina con "+1 mes"...');
  const start = addDays(today, -5);
  await openPaymentForm(page);
  await startsOnField(page).fill(start);
  await page.getByRole('button', { name: '+1 mes', exact: true }).click();
  const end = await endsOnField(page).inputValue();
  assert.match(end, /^\d{4}-\d{2}-\d{2}$/, '"+1 mes" no llenó la fecha de fin');
  await saveAndClose(page, 'Registrar pago', 'el registro del pago');
  await page.getByText('Activo', { exact: true }).waitFor();
  await page.getByText(rangeText(start, end), { exact: true }).waitFor();
  await page.getByText(`Pagado hasta ${longDate(end)}`, { exact: true }).waitFor();
  assert.equal(
    periodsOf(userId),
    `${start}|${end}`,
    'la base no guardó las fechas que mostraba el formulario',
  );

  console.log('Corrigiendo el pago: el fin pasa a ser ayer y el miembro queda inactivo...');
  await page
    .getByRole('button', { name: `Editar el pago: ${rangeText(start, end)}`, exact: true })
    .click();
  await page.getByRole('form', { name: 'Editar pago' }).waitFor();
  await endsOnField(page).fill(yesterday);
  await saveAndClose(page, 'Editar pago', 'la corrección del pago');
  await page.getByText('Inactivo', { exact: true }).waitFor();
  await page.getByText(rangeText(start, yesterday), { exact: true }).waitFor();
  await page.getByText(`Último vencimiento: ${longDate(yesterday)}`, { exact: true }).waitFor();
  assert.equal(periodsOf(userId), `${start}|${yesterday}`, 'la base no guardó la corrección');

  console.log('Registrando un pago que se cruza con el anterior: la base lo rechaza (23P01)...');
  await openPaymentForm(page);
  await startsOnField(page).fill(addDays(today, -3));
  await endsOnField(page).fill(addDays(today, 10));
  const refused = nextRequest(page, 'POST', 'paid_periods');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const refusal = await refused;
  assert.equal(refusal.ok(), false, 'la base aceptó el pago que se cruzaba con otro');
  assert.equal((await refusal.json()).code, '23P01', 'la base no rechazó el cruce con el código 23P01');
  try {
    await page
      .getByRole('alert')
      .filter({ hasText: 'Esas fechas se cruzan con otro pago de este miembro.' })
      .waitFor();
  } catch {
    throw new Error(`no apareció el aviso de que las fechas se cruzan${await visibleAlerts(page)}`);
  }
  assert.equal(periodsOf(userId), `${start}|${yesterday}`, 'el pago que se cruzaba quedó guardado');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('form', { name: 'Registrar pago' }).waitFor({ state: 'detached' });

  console.log('Borrando un pago en la base a espaldas de la página y corrigiéndolo...');
  const secondStart = today;
  const secondEnd = addDays(today, 9);
  await recordPayment(page, secondStart, secondEnd, 'el registro del segundo pago');
  assert.equal(
    periodsOf(userId),
    `${start}|${yesterday},${secondStart}|${secondEnd}`,
    'la base no guardó el segundo pago',
  );
  psql(`delete from public.paid_periods where member_id = '${userId}' and starts_on = '${secondStart}'`);
  await page
    .getByRole('button', { name: `Editar el pago: ${rangeText(secondStart, secondEnd)}`, exact: true })
    .click();
  await page.getByRole('form', { name: 'Editar pago' }).waitFor();
  await endsOnField(page).fill(addDays(today, 8));
  const corrected = nextRequest(page, 'PATCH', 'paid_periods');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expectPaymentGone(
    page,
    corrected,
    rangeText(secondStart, secondEnd),
    'la corrección de un pago que ya no existe',
  );
  await page.getByRole('form', { name: 'Editar pago' }).waitFor({ state: 'detached' });
  await expectCount(paymentRows(page), 1, 'la lista no se leyó de nuevo sin el pago borrado');

  console.log('Borrando otro pago en la base a espaldas de la página y eliminándolo...');
  const thirdStart = addDays(today, 12);
  const thirdEnd = addDays(today, 20);
  await recordPayment(page, thirdStart, thirdEnd, 'el registro del tercer pago');
  psql(`delete from public.paid_periods where member_id = '${userId}' and starts_on = '${thirdStart}'`);
  await page
    .getByRole('button', {
      name: `Eliminar el pago: ${rangeText(thirdStart, thirdEnd)}`,
      exact: true,
    })
    .click();
  await page
    .getByRole('group', { name: '¿Eliminar este pago? Esta acción no se puede deshacer.' })
    .waitFor();
  const erased = nextRequest(page, 'DELETE', 'paid_periods');
  await page.getByRole('button', { name: 'Sí, eliminar el pago', exact: true }).click();
  await expectPaymentGone(
    page,
    erased,
    rangeText(thirdStart, thirdEnd),
    'la eliminación de un pago que ya no existe',
  );
  await expectCount(paymentRows(page), 1, 'la lista no se leyó de nuevo sin el pago borrado');
  assert.equal(periodsOf(userId), `${start}|${yesterday}`, 'la base cambió el pago que quedaba');

  console.log('Eliminando el último pago: primero se cancela, después se confirma...');
  const lastRange = rangeText(start, yesterday);
  const question = page.getByRole('group', {
    name: '¿Eliminar este pago? Esta acción no se puede deshacer.',
  });
  await page.getByRole('button', { name: `Eliminar el pago: ${lastRange}`, exact: true }).click();
  await question.waitFor();
  await question.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await question.waitFor({ state: 'detached' });
  assert.equal(periodsOf(userId), `${start}|${yesterday}`, 'cancelar la pregunta eliminó el pago');

  await page.getByRole('button', { name: `Eliminar el pago: ${lastRange}`, exact: true }).click();
  await question.waitFor();
  await question.getByRole('button', { name: 'Sí, eliminar el pago', exact: true }).click();
  await page.getByText('Todavía no hay pagos registrados.', { exact: true }).waitFor();
  await page.getByText('Sin pagos registrados', { exact: true }).waitFor();
  await page.getByText('Inactivo', { exact: true }).waitFor();
  assert.equal(periodsOf(userId), '', 'la base conserva pagos después de eliminar el último');
}

// The notice about the keep-alive: any admin page has it, so the page of the
// member stays where it is and is only reloaded.
const keepaliveNotice = (page) => page
  .getByRole('status')
  .filter({ hasText: 'ping de mantenimiento' });

// Reloads the page and waits for the answer of the heartbeat, so that a notice
// that is not there is not simply a notice that has not come yet.
async function reloadAfterHeartbeat(page) {
  const answered = nextRequest(page, 'GET', 'ops_heartbeat');
  await page.reload();
  try {
    await answered;
  } catch {
    throw new Error('la página no pidió el latido (ops_heartbeat) al recargarse');
  }
  await page.getByRole('heading', { level: 2, name: NAME }).waitFor();
  await page.waitForLoadState('networkidle');
  // The answer is drawn on the next tick of the page.
  await sleep(300);
}

async function adminNotice(page) {
  console.log('Comprobando el aviso del latido: con un último ping de hace cuatro días...');
  savedHeartbeat = heartbeatNow();
  psql(
    'insert into public.ops_heartbeat (id, last_ping_at) '
    + "values (1, now() - interval '4 days') "
    + 'on conflict (id) do update set last_ping_at = excluded.last_ping_at',
  );
  const pingDay = psql(
    "select (last_ping_at at time zone 'America/Lima')::date::text "
    + 'from public.ops_heartbeat where id = 1',
  );
  await reloadAfterHeartbeat(page);
  await keepaliveNotice(page).waitFor();
  const stale = (await keepaliveNotice(page).textContent()).trim();
  assert.ok(
    stale.startsWith(`El último ping de mantenimiento registrado fue el ${longDate(pingDay)}, hace 4 días.`),
    `el aviso no dice cuándo fue el último ping: "${stale}"`,
  );
  assert.ok(stale.includes('«Keep-alive ping»'), `el aviso no nombra el flujo: "${stale}"`);

  console.log('...sin aviso después de un ping nuevo (public.keepalive())...');
  psql('select public.keepalive()');
  await reloadAfterHeartbeat(page);
  assert.equal(await keepaliveNotice(page).count(), 0, 'el aviso sigue después de un ping reciente');

  console.log('...y con el aviso de que no hay ningún ping si la tabla está vacía...');
  psql('delete from public.ops_heartbeat');
  await reloadAfterHeartbeat(page);
  await keepaliveNotice(page)
    .filter({ hasText: 'Todavía no hay ningún ping de mantenimiento registrado.' })
    .waitFor();
}

// The member leg: the attendance controls of the public schedule, against the real
// PostgREST. The class is the first one of Monday, or of Tuesday when today is
// Monday, so that its next occurrence is never today whatever the time of day (a
// class that started earlier today would be a different card state). The page
// looks one week ahead, so it is always inside the window. The member is no
// administrator yet: an administrator's policies read everyone's rows, and the
// own-rows filters of the page would go unproven.
async function memberAttendanceLeg(page) {
  const userId = psql(`select id from auth.users where email = '${EMAIL}'`);
  assert.ok(userId, 'no encontré la cuenta de prueba en la base antes de la asistencia');
  const today = psql("select (now() at time zone 'America/Lima')::date::text");
  const weekdayToday = Number(
    psql("select extract(dow from (now() at time zone 'America/Lima'))::int"),
  );
  const weekday = weekdayToday === 1 ? 2 : 1;
  const dayName = weekday === 2 ? 'Martes' : 'Lunes';
  const classDate = addDays(today, (weekday - weekdayToday + 7) % 7);

  const card = page.getByRole('region', { name: dayName }).getByRole('article').first();
  const confirmButton = card.getByRole('button', { name: 'Confirmar asistencia' });
  const cancelButton = card.getByRole('button', { name: 'Cancelar asistencia' });
  const inactive = card.getByText('Tu membresía no está activa.', { exact: true });
  const confirmationsOf = () => psql(
    `select count(*) from public.attendance_confirmations where member_id = '${userId}'`,
  );
  const expectNoLoadError = async (step) => {
    assert.equal(
      await page.getByText('No pudimos cargar tu asistencia.').count(),
      0,
      `${step}: la página no pudo leer la asistencia${await visibleAlerts(page)}`,
    );
  };

  console.log('Abriendo los horarios sin ningún pago: membresía inactiva y WhatsApp...');
  await page.goto(`${SITE}/schedules`);
  await page.getByRole('heading', { level: 1, name: 'Horarios' }).waitFor();
  await inactive.waitFor();
  assert.equal(
    await card.getByRole('link', { name: 'Escríbenos por WhatsApp' }).count(),
    1,
    'la clase inactiva no ofrece el enlace de WhatsApp',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Confirmar asistencia' }).count(),
    0,
    'un miembro sin pagos ve "Confirmar asistencia"',
  );
  await expectNoLoadError('sin pagos');
  const start = await card.locator('time').first().getAttribute('datetime');
  assert.match(start ?? '', /^\d{2}:\d{2}$/, 'la clase no muestra su hora de inicio');

  console.log('Registrando un pago con SQL y recargando: la clase se puede confirmar...');
  psql(
    'insert into public.paid_periods (member_id, starts_on, ends_on) '
    + `values ('${userId}', '${today}', '${addDays(today, 30)}')`,
  );
  const periodsRead = nextRequest(page, 'GET', 'paid_periods');
  await page.reload();
  await confirmButton.waitFor();
  await card.getByText(`Próxima clase: ${longDate(classDate)}`, { exact: true }).waitFor();
  // What the real PostgREST was asked: the own rows only, from today, in order.
  const periodsResponse = await periodsRead;
  const periodsUrl = new URL(periodsResponse.url());
  assert.equal(periodsResponse.status(), 200, 'la lectura de los pagos propios no dio 200');
  assert.equal(periodsUrl.searchParams.get('member_id'), `eq.${userId}`);
  assert.equal(periodsUrl.searchParams.get('ends_on'), `gte.${today}`);
  assert.equal(periodsUrl.searchParams.get('order'), 'starts_on.asc');
  await expectNoLoadError('con un pago');

  console.log('Confirmando la asistencia...');
  await confirmButton.click();
  await card.getByText('Confirmaste tu asistencia.', { exact: true }).waitFor();
  await cancelButton.waitFor();
  assert.equal(await confirmationsOf(), '1', 'la confirmación no quedó en la base');
  // The database prints a time as HH:MM:SS, and the starts_at it computed is ahead.
  assert.match(
    psql(
      "select start_time::text || '|' || end_time::text || '|' || (starts_at > now())::text "
      + `from public.attendance_confirmations where member_id = '${userId}'`,
    ),
    new RegExp(`^${start}:00\\|\\d{2}:\\d{2}:00\\|true$`),
    'la fila guardada no tiene las horas HH:MM:SS con segundos en cero ni un starts_at futuro',
  );

  console.log('Recargando: la confirmación sigue (la hora HH:MM:SS se normaliza)...');
  await page.reload();
  await cancelButton.waitFor();
  assert.equal(await confirmButton.count(), 0, 'tras recargar, la clase confirmada ofrece confirmar');
  await expectNoLoadError('con la confirmación');

  console.log('Cancelando la asistencia...');
  await cancelButton.click();
  await confirmButton.waitFor();
  assert.equal(await confirmationsOf(), '0', 'la cancelación no borró la fila');

  console.log('Acortando el pago hasta hoy: una clase de otro día avisa cuándo vence...');
  psql(`update public.paid_periods set ends_on = '${today}' where member_id = '${userId}'`);
  await page.reload();
  await card.getByText(`Tu membresía vence el ${longDate(today)}.`, { exact: true }).waitFor();
  assert.equal(await card.getByRole('button').count(), 0, 'una clase fuera del pago ofrece un botón');
  await expectNoLoadError('con el pago acortado');

  console.log('Borrando el pago: vuelve el mensaje de membresía inactiva...');
  psql(`delete from public.paid_periods where member_id = '${userId}'`);
  await page.reload();
  await inactive.waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Confirmar asistencia' }).count(),
    0,
    'un miembro sin pagos ve "Confirmar asistencia" tras borrar el pago',
  );
}

async function adminLeg(page) {
  const userId = psql(`select id from auth.users where email = '${EMAIL}'`);
  assert.ok(userId, 'no encontré la cuenta de prueba en la base antes de la administración');

  await adminAccess(page);
  await adminMemberPage(page, userId);
  await adminPayments(page, userId);
  await adminNotice(page);

  console.log('Volviendo al inicio desde la administración...');
  await mainMenu(page).getByRole('link', { name: 'Inicio', exact: true }).click();
  await expectHome(page, 'la vuelta al inicio desde la administración');
}

async function accountLeg(page) {
  console.log('Comprobando el menú de un miembro con sesión...');
  await mainMenu(page).getByRole('link', { name: 'Mi cuenta' }).waitFor();
  assert.equal(
    await mainMenu(page).getByRole('link', { name: 'Ingresar' }).count(),
    0,
    'el menú ofrece "Ingresar" a un miembro que ya ingresó',
  );

  console.log('Abriendo la página de la cuenta...');
  await mainMenu(page).getByRole('link', { name: 'Mi cuenta' }).click();
  await page.waitForURL(`${SITE}/account`);
  await page.getByRole('heading', { level: 1, name: 'Mi cuenta' }).waitFor();
  await page.getByText(NAME, { exact: true }).waitFor();
  await page.getByText(EMAIL, { exact: true }).waitFor();
  await page.getByText(`Aceptaste el aviso de privacidad versión ${NOTICE_VERSION} el `).waitFor();

  console.log('Cerrando la sesión de este dispositivo...');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expectHome(page, 'el cierre de sesión');
  await mainMenu(page).getByRole('link', { name: 'Ingresar' }).waitFor();
  assert.equal(
    await mainMenu(page).getByRole('link', { name: 'Mi cuenta' }).count(),
    0,
    'el menú sigue ofreciendo "Mi cuenta" después de cerrar la sesión',
  );
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    null,
    'cerrar la sesión no borró la sesión guardada',
  );

  console.log('Ingresando otra vez desde el menú y volviendo a la cuenta...');
  await mainMenu(page).getByRole('link', { name: 'Ingresar' }).click();
  await page.getByRole('heading', { level: 1, name: 'Ingresar' }).waitFor();
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expectHome(page, 'el ingreso desde el menú');
  await mainMenu(page).getByRole('link', { name: 'Mi cuenta' }).click();
  await page.getByRole('heading', { level: 1, name: 'Mi cuenta' }).waitFor();

  const userId = psql(`select id from auth.users where email = '${EMAIL}'`);
  assert.ok(userId, 'no encontré la cuenta de prueba en la base antes de eliminarla');

  console.log('Eliminando la cuenta con su confirmación...');
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await page.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();
  try {
    await page.getByText('Tu cuenta fue eliminada.').waitFor();
  } catch {
    throw new Error(`no apareció el aviso de la cuenta eliminada${await visibleAlerts(page)}`);
  }
  await page.getByRole('link', { name: 'Ir al inicio' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/account', 'la página salió de la cuenta eliminada');

  console.log('Comprobando que la cuenta y su perfil ya no están en la base...');
  assert.equal(
    psql(`select count(*) from auth.users where id = '${userId}'`),
    '0',
    'la cuenta sigue en auth.users después de eliminarla',
  );
  assert.equal(
    psql(`select count(*) from public.profiles where id = '${userId}'`),
    '0',
    'el perfil sigue en la base después de eliminar la cuenta',
  );

  console.log('Comprobando que ya no se puede ingresar con esa cuenta...');
  await page.goto(`${SITE}/login`);
  await page.getByLabel('Correo', { exact: true }).fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos.' }).waitFor();
}

// Puts public.ops_heartbeat back as the admin leg found it: the row it had, to
// the microsecond, or no row if it had none. Nothing is done if the leg never got
// to change it.
function restoreHeartbeat(problems) {
  if (savedHeartbeat === null) {
    return;
  }
  try {
    psql(
      savedHeartbeat === ''
        ? 'delete from public.ops_heartbeat where id = 1'
        : 'insert into public.ops_heartbeat (id, last_ping_at) '
          + `values (1, '${savedHeartbeat}') `
          + 'on conflict (id) do update set last_ping_at = excluded.last_ping_at',
    );
    if (heartbeatNow() !== savedHeartbeat) {
      problems.push('no pude dejar public.ops_heartbeat como estaba antes de la prueba.');
    }
  } catch (cause) {
    problems.push(`no pude restaurar public.ops_heartbeat: ${cause.message}`);
  }
}

// Removes exactly the account this run created (its profile and its payments go
// with it, by cascade) and its emails, puts the heartbeat back, and says so if it
// could not. The account leg may have deleted the account already: that is not a
// problem, only an account that is still there afterwards is.
async function cleanUp(problems) {
  try {
    psql(`delete from auth.users where email = '${EMAIL}'`);
    const left = psql(`select count(*) from auth.users where email = '${EMAIL}'`);
    if (left !== '0') {
      problems.push(`no pude borrar la cuenta de prueba ${EMAIL} de la base local.`);
    }
  } catch (cause) {
    problems.push(`no pude borrar la cuenta de prueba ${EMAIL}: ${cause.message}`);
  }
  restoreHeartbeat(problems);
  try {
    const ids = (await messagesTo(EMAIL)).map((message) => message.ID);
    if (ids.length) {
      await mailpit('/api/v1/messages', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ IDs: ids }),
      });
    }
  } catch (cause) {
    problems.push(`no pude borrar los correos de prueba de Mailpit: ${cause.message}`);
  }
}

async function main() {
  if (!(await isUp(`${API_URL}/auth/v1/health`)) || !(await isUp(`${MAILPIT_URL}/api/v1/info`))) {
    console.error(
      `El stack local de Supabase no responde (la API en ${API_URL} o Mailpit en ${MAILPIT_URL}).\n`
      + `Inícialo con: npx --yes ${SUPABASE_CLI} start -x vector`,
    );
    process.exitCode = 1;
    return;
  }
  if (await portIsBusy(PORT)) {
    console.error(
      `El puerto ${PORT} está ocupado (¿hay un "npm run dev" abierto?). El sitio de esta prueba `
      + `debe servirse ahí, porque ${SITE} es la dirección que el stack local permite.`,
    );
    process.exitCode = 1;
    return;
  }

  const outDir = mkdtempSync(join(tmpdir(), 'el-auth-e2e-'));
  const env = {
    VITE_SUPABASE_URL: API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: null,
    // Pinned, so that a local env file cannot change what the notice does.
    VITE_KEEPALIVE_ALERT_DAYS: '3',
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const violations = [];
  const problems = [];
  let server = null;
  let browser = null;

  try {
    env.VITE_SUPABASE_PUBLISHABLE_KEY = readPublishableKey();
    assert.ok(NOTICE_VERSION, 'no encontré CURRENT_NOTICE_VERSION en noticeVersion.js');

    // vite.config.js and the client bundle both read these from process.env,
    // where they win over any .env file, so the build is exactly this one.
    Object.assign(process.env, env);
    console.log('Construyendo el sitio contra el stack local...');
    await build({
      root: repoRoot,
      logLevel: 'warn',
      build: { outDir, emptyOutDir: true },
    });

    server = await preview({
      root: repoRoot,
      logLevel: 'warn',
      build: { outDir },
      preview: { port: PORT, strictPort: true },
    });

    browser = await chromium.launch();
    const { page } = await openContext(browser, violations, problems);
    await signUp(page);
    await confirmByEmail(page);
    await signInAgain(page);
    await resetPassword(page);
    await memberAttendanceLeg(page);
    await adminLeg(page);
    await accountLeg(page);
  } catch (cause) {
    problems.push(cause.message);
  } finally {
    // Whatever the journey reached before it stopped, a violation counts.
    violations.forEach((violation) => problems.push(`violación de la política: ${violation}`));
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    // The account and its emails go first, while the stack is surely up; a
    // failure of the teardown below is not this run's verdict either.
    await cleanUp(problems);
    try {
      if (browser) await browser.close();
      if (server) await server.close();
    } catch (cause) {
      console.error(`No pude cerrar el navegador o el servidor: ${cause.message}`);
    }
    rmSync(outDir, { recursive: true, force: true });
  }

  if (problems.length) {
    console.error(`\nEl registro real falló (${problems.length} problema(s)):`);
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nEl registro real funciona: cuenta creada, correo confirmado con el botón, consentimiento '
    + 'guardado, enlace usado rechazado, ingreso con la contraseña, contraseña restablecida con '
    + 'el correo de recuperación, asistencia en los horarios (inactiva, confirmada, cancelada, vencida), administración (directorio, pagos registrados, corregidos, '
    + 'rechazados por cruce y encontrados borrados, aviso del latido y su restauración), página '
    + 'de la cuenta, cierre de sesión, cuenta eliminada y ninguna violación de la política de '
    + 'seguridad.',
  );
}

await main();
