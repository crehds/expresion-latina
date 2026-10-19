/*
 * Drives a real sign-up through the local Supabase stack, in a real browser.
 *
 * The unit tests fake the backend, and the CSP check fakes its origin, so
 * neither proves that what the app sends is what Supabase Auth accepts. This
 * does: it builds the site against the local stack, opens the login page, signs
 * a new account up, reads the confirmation email from Mailpit, follows its
 * link in the same page, and checks that the member ends on the home page
 * signed in with no consent screen, and that the profile recorded the consent
 * of the current notice version. It then signs in again with the password, once
 * with a wrong one, to see the real "wrong credentials" answer map to its
 * message. A `securitypolicyviolation` anywhere in the journey is a failure.
 *
 * The page is served on port 3000 and browsed as http://localhost:3000, never
 * 127.0.0.1: supabase/config.toml names that origin as the site URL and in the
 * redirect allowlist, and the PKCE verifier lives in the origin the callback
 * returns to. Requests to any other origin (Google Fonts, the map) are aborted.
 *
 * It needs the local stack (Docker) and, unlike the other checks, is not part
 * of `npm run test:e2e` or of CI. It creates one account, e2e-auth-<time>@
 * example.test, and removes it again, with its profile and its email, whether
 * the journey passes or not.
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
const API_URL = 'http://127.0.0.1:54321';
const MAILPIT_URL = 'http://127.0.0.1:54324';
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
const WRONG_PASSWORD = 'otraclave1';

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

async function waitForConfirmationLink(address) {
  const deadline = Date.now() + STEP_TIMEOUT;
  while (Date.now() < deadline) {
    const [message] = await messagesTo(address);
    if (message) {
      const { HTML: html } = await (await mailpit(`/api/v1/message/${message.ID}`)).json();
      const link = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(html)?.[1];
      assert.ok(link, 'el correo de confirmación no trae el enlace de verificación');
      return link.replaceAll('&amp;', '&');
    }
    await sleep(300);
  }
  throw new Error(`el correo de confirmación no llegó a Mailpit en ${STEP_TIMEOUT / 1000} segundos`);
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
  const link = await waitForConfirmationLink(EMAIL);

  console.log('Abriendo el enlace de confirmación en la misma página...');
  await page.goto(link);
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

// Removes exactly the account this run created (its profile goes with it, by
// cascade) and its emails, and says so if it could not.
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
      'El stack local de Supabase no responde (la API en 127.0.0.1:54321 o Mailpit en 127.0.0.1:54324).\n'
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
    '\nEl registro real funciona: cuenta creada, correo confirmado, consentimiento guardado, '
    + 'ingreso con la contraseña y ninguna violación de la política de seguridad.',
  );
}

await main();
