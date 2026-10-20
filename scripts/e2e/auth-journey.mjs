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
 * signs in and the old one does not. Then the account leg: the menu offers "Mi
 * cuenta" and no "Ingresar", the account page shows the name, the email and the
 * consent on record, "Cerrar sesión" brings "Ingresar" back, a new sign-in
 * reaches the page again, and "Eliminar mi cuenta" erases the auth user and its
 * profile, after which that account can no longer sign in. A
 * `securitypolicyviolation` anywhere in the journey is a failure.
 *
 * The page is served on port 3000 and browsed as http://localhost:3000, never
 * 127.0.0.1: supabase/config.toml names that origin as the site URL and in the
 * redirect allowlist, and the PKCE verifier lives in the origin the callback
 * returns to. Requests to any other origin (Google Fonts, the map) are aborted.
 *
 * It needs the local stack (Docker) and, unlike the other checks, is not part
 * of `npm run test:e2e` or of CI. It creates one account, e2e-auth-<time>@
 * example.test, and removes it again, with its profile and its email, whether
 * the journey passes or not (the account leg deletes it itself; the cleanup
 * then finds nothing left to remove).
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

// The local stack's defaults (supabase/config.toml leaves the ports alone).
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

// Removes exactly the account this run created (its profile goes with it, by
// cascade) and its emails, and says so if it could not. The account leg may have
// deleted the account already: that is not a problem, only an account that is
// still there afterwards is.
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
      'El stack local de Supabase no responde (la API en 127.0.0.1:34321 o Mailpit en 127.0.0.1:34324).\n'
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
    + 'el correo de recuperación, página de la cuenta, cierre de sesión, cuenta eliminada y ninguna '
    + 'violación de la política de seguridad.',
  );
}

await main();
