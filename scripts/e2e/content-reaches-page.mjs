/*
 * The one check that proves content actually reaches a rendered page.
 *
 * scripts/data/__tests__/example-import.test.mjs proves the importer's output
 * is data the app could render; it never renders anything. This goes one step
 * further: import the example workbook for real, build the site, serve the
 * build, and read a review and a genre description out of an actual browser.
 * Both render as nothing today (a review needs one to exist; a genre's
 * description is only ever read as the lead under its own detail page), so
 * this is the only thing that would have caught either being dropped between
 * the workbook and the screen.
 *
 * This mutates tracked files on purpose — the real src/data/academy.json and
 * whatever photograph the import writes into src/assets/images/teachers — so
 * it restores both, in a finally that runs whether the checks below pass or
 * throw. It is deliberately not part of `npm test` or `npm run test:data`:
 * a build and a real browser make it far slower than either, and it is meant
 * to be run on demand, not on every save.
 *
 * Usage: npm run test:e2e
 */
import assert from 'node:assert/strict';
import {
  readdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
// The import resolver cannot follow vite's package.json "exports" map, the
// same limitation vite.config.js already carries this same rule off for.
// eslint-disable-next-line import/no-unresolved
import { build, preview } from 'vite';

import runImport from '../data/import.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = resolve(repoRoot, 'content/ejemplo-completo.xlsx');
const ACADEMY_JSON = resolve(repoRoot, 'src/data/academy.json');
const PHOTOS_DIR = resolve(repoRoot, 'src/assets/images/teachers');

// vite preview's own default. Pinned and strict rather than left to
// auto-pick, so a port already in use fails loudly instead of silently
// serving whatever was already running there.
const PORT = 4173;

async function main() {
  const originalAcademyJson = readFileSync(ACADEMY_JSON);
  const originalPhotos = new Set(readdirSync(PHOTOS_DIR));

  let server = null;
  let browser = null;
  const problems = [];

  try {
    console.log('Importando la planilla de ejemplo en src/data/academy.json...');
    const code = await runImport([FIXTURE]);
    assert.equal(code, 0, 'la planilla de ejemplo debería importarse sin problemas');

    const academy = JSON.parse(readFileSync(ACADEMY_JSON, 'utf8'));
    const [review] = academy.reviews;
    const salsa = academy.genres.find((genre) => genre.id === 'salsa');

    assert.ok(review, 'la planilla de ejemplo debería traer al menos una reseña');
    assert.ok(salsa?.description, 'la planilla de ejemplo debería traer una descripción para salsa');

    console.log('Construyendo el sitio...');
    await build({ root: repoRoot, logLevel: 'warn' });

    console.log('Sirviendo el sitio construido...');
    server = await preview({
      root: repoRoot,
      logLevel: 'warn',
      preview: { port: PORT, strictPort: true },
    });
    const [baseUrl] = server.resolvedUrls.local;

    browser = await chromium.launch();
    const page = await browser.newPage();

    // Rendered by ReviewsStrip on the landing page, only once a review exists.
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.review', { timeout: 10000 });
    const reviewTexts = await page.locator('.review__text').allTextContents();
    if (!reviewTexts.some((text) => text.includes(review.text))) {
      problems.push(`Home: no encontré la reseña "${review.text}" en la página.`);
    }

    // Rendered by DanceVideos as the page lead, only on the genre's own route
    // — the genre list page never shows a description at all.
    await page.goto(`${baseUrl}dances/salsa/videos`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.page__lead', { timeout: 10000 });
    const lead = await page.locator('.page__lead').first().textContent();
    if (lead?.trim() !== salsa.description) {
      problems.push(
        `Salsa: la descripción en la página ("${lead?.trim()}") no coincide con la de la planilla `
        + `("${salsa.description}").`,
      );
    }
  } catch (cause) {
    problems.push(cause.message);
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();

    // Restored unconditionally: this script mutates tracked content on
    // purpose, and a failing run must leave the tree exactly as clean as a
    // passing one. git would restore academy.json on its own since it is
    // tracked, but a photograph the import newly wrote is untracked and git
    // would never touch it.
    writeFileSync(ACADEMY_JSON, originalAcademyJson);
    readdirSync(PHOTOS_DIR).forEach((file) => {
      if (!originalPhotos.has(file)) unlinkSync(resolve(PHOTOS_DIR, file));
    });
  }

  if (problems.length) {
    console.error(`\nEl contenido de la planilla no llegó completo a la página (${problems.length} problema(s)):`);
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nLa reseña y la descripción de la planilla llegan a la página construida.');
}

await main();
