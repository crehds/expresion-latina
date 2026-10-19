/*
 * Proves the Content-Security-Policy the build ships does not break the site.
 *
 * The policy is a <meta> tag the build injects (src/shared/security/cspPlugin.js),
 * so only a real browser on a real build can say whether something the pages
 * need is blocked. This builds the site twice and visits every public route of
 * each build, collecting every `securitypolicyviolation` event and every
 * console error that names the policy:
 *
 *  1. The default build, with the backend feature off.
 *  2. A build with a (fake) Supabase project configured, which widens
 *     `connect-src` to that origin. On the public routes nothing may call that
 *     origin and the supabase-js chunk must not even be requested, because no
 *     session is stored: the feature stays lazy until it is needed. This build
 *     also visits the login page, which uses the backend by design: it loads
 *     supabase-js and asks the (fake, here aborted) origin which providers are
 *     on, so on that page those requests are expected and only the policy
 *     violations count.
 *
 * It reads the tracked content as it is and writes nothing tracked: each build
 * goes to a temporary directory that is removed afterwards. Requests to any
 * other origin (Google Fonts, the map) are aborted instead of sent, so the
 * check needs no network, and an aborted request is not a policy violation.
 *
 * Usage: npm run test:e2e:csp
 */
// The callbacks given to page.addInitScript and page.evaluate run in the page.
/* eslint-env browser */
import assert from 'node:assert/strict';
import {
  mkdtempSync, readdirSync, readFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
// The import resolver cannot follow vite's package.json "exports" map, the
// same limitation vite.config.js already carries this same rule off for.
// eslint-disable-next-line import/no-unresolved
import { build, preview } from 'vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ACADEMY_JSON = resolve(repoRoot, 'src/data/academy.json');

// vite preview's own default, pinned and strict like the content check: a port
// already in use fails loudly instead of serving whatever was running there.
const PORT = 4173;

const FAKE_SUPABASE_ORIGIN = 'https://abcd1234.supabase.co';

// Marker of the supabase-js bundle (auth-js's client class survives minifying).
const SUPABASE_JS_MARKER = 'GoTrueClient';

// The pages that exist only while the feature is on. `heading` is what proves
// the page rendered under the policy, and that it is not a blank or a not-found
// page.
const ACCOUNT_ROUTES = [{ path: '/login', heading: 'Ingresar' }];

const VARIANTS = [
  {
    name: 'feature off (default build)',
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    supabaseOrigin: null,
    accountRoutes: [],
  },
  {
    name: 'feature on (Supabase configured)',
    env: {
      VITE_SUPABASE_URL: FAKE_SUPABASE_ORIGIN,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_fake',
    },
    supabaseOrigin: FAKE_SUPABASE_ORIGIN,
    accountRoutes: ACCOUNT_ROUTES,
  },
];

function publicRoutes() {
  const academy = JSON.parse(readFileSync(ACADEMY_JSON, 'utf8'));
  const [teacher] = academy.teachers;
  const [genre] = academy.genres;
  assert.ok(teacher?.id, 'academy.json debería traer al menos un profesor');
  assert.ok(genre?.id, 'academy.json debería traer al menos un género');

  return [
    '/',
    '/teachers',
    `/teachers/${teacher.id}`,
    '/dances',
    `/dances/${genre.id}/videos`,
    '/schedules',
    '/contact',
    '/esta-direccion-no-existe',
  ];
}

// The files of a build whose text contains the marker.
function chunksContaining(outDir, marker) {
  const assets = join(outDir, 'assets');
  return readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .filter((file) => readFileSync(join(assets, file), 'utf8').includes(marker));
}

async function visitRoutes(browser, baseUrl, variant, routes, supabaseChunks) {
  const problems = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  const { origin } = new URL(baseUrl);
  // The public routes first, then the account pages this build has. The latter
  // use the backend, so the "no backend request" check is not theirs.
  const visits = [
    ...routes.map((path) => ({ path, usesBackend: false })),
    ...variant.accountRoutes.map((account) => ({ ...account, usesBackend: true })),
  ];
  let visit = { path: '', usesBackend: false };

  await context.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });

  // Nothing leaves the machine; whatever is aborted is still seen by 'request'.
  await context.route((url) => url.origin !== origin, (request) => request.abort());

  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy/i.test(message.text())) {
      problems.push(`${visit.path}: error de consola sobre la política: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    if (visit.usesBackend) {
      return;
    }
    const { origin: target, pathname } = new URL(request.url());
    if (variant.supabaseOrigin && target === variant.supabaseOrigin) {
      problems.push(`${visit.path}: pidió ${request.url()} sin una sesión guardada.`);
    }
    if (target === origin && supabaseChunks.some((chunk) => pathname.endsWith(chunk))) {
      problems.push(`${visit.path}: cargó el paquete de supabase-js (${pathname}) sin una sesión guardada.`);
    }
  });

  for (const next of visits) {
    visit = next;
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`${baseUrl}${next.path.slice(1)}`, { waitUntil: 'networkidle' });
    // eslint-disable-next-line no-await-in-loop
    const rendered = await page.locator('#root > *').count();
    if (!rendered) {
      problems.push(`${next.path}: la página no mostró nada.`);
    }
    if (next.heading) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await page.getByRole('heading', { level: 1, name: next.heading }).waitFor({ timeout: 10000 });
      } catch {
        problems.push(`${next.path}: la página no mostró el encabezado "${next.heading}".`);
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const violations = await page.evaluate(() => window.cspViolations);
    violations.forEach((violation) => problems.push(`${next.path}: violación de la política: ${violation}`));
  }

  await context.close();
  return problems;
}

async function checkVariant(browser, variant, routes) {
  const outDir = mkdtempSync(join(tmpdir(), 'el-csp-e2e-'));
  const previous = Object.fromEntries(
    Object.keys(variant.env).map((key) => [key, process.env[key]]),
  );
  let server = null;

  try {
    // vite.config.js and the client bundle both read these from process.env,
    // where they win over any .env file, so each build is exactly its variant.
    Object.assign(process.env, variant.env);

    console.log(`Construyendo el sitio: ${variant.name}...`);
    await build({
      root: repoRoot,
      logLevel: 'warn',
      build: { outDir, emptyOutDir: true },
    });

    const supabaseChunks = chunksContaining(outDir, SUPABASE_JS_MARKER);
    // The chunk is emitted whenever the client is reachable, even with the
    // feature off; what matters is that no public route ever requests it. It
    // must exist, or the "never requested" check below proves nothing.
    assert.ok(
      supabaseChunks.length > 0,
      'el sitio debería traer el paquete de supabase-js como un archivo aparte (si no, esta comprobación no prueba nada)',
    );

    server = await preview({
      root: repoRoot,
      logLevel: 'warn',
      build: { outDir },
      preview: { port: PORT, strictPort: true },
    });
    const [baseUrl] = server.resolvedUrls.local;

    console.log(`Visitando ${routes.length + variant.accountRoutes.length} rutas: ${variant.name}...`);
    return await visitRoutes(browser, baseUrl, variant, routes, supabaseChunks);
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    try {
      if (server) await server.close();
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  const routes = publicRoutes();
  const problems = [];
  let browser = null;

  try {
    browser = await chromium.launch();
    for (const variant of VARIANTS) {
      // eslint-disable-next-line no-await-in-loop
      const found = await checkVariant(browser, variant, routes);
      found.forEach((problem) => problems.push(`[${variant.name}] ${problem}`));
    }
  } catch (cause) {
    problems.push(cause.message);
  } finally {
    try {
      if (browser) await browser.close();
    } catch (cause) {
      console.error(`No pude cerrar el navegador: ${cause.message}`);
    }
  }

  if (problems.length) {
    console.error(`\nLa política de seguridad rompe el sitio (${problems.length} problema(s)):`);
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nNinguna ruta pública viola la política de seguridad, con la función apagada y encendida, '
    + 'ni tampoco la página de ingreso con la función encendida.',
  );
}

await main();
