/*
 * Callbacks passed to page.evaluate are serialised and run inside the
 * browser, not in Node, so document is defined where they execute.
 */
/* global document */
// Drives the running dev server in a real browser and captures the viewports
// that matter. Jest renders through jsdom, which has no layout engine at all,
// so nothing there can tell us whether a grid or a chip row actually looks right.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2] ?? 'http://localhost:3000/schedules';
const outDir = process.argv[3] ?? 'screenshots';

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const { name, width, height } of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width, height } });

  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));

  await page.goto(url, { waitUntil: 'networkidle' });

  // The page is lazy-loaded, so wait for real content rather than a fixed delay.
  await page.waitForSelector('.schedules', { timeout: 10000 });

  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });

  const cards = await page.locator('.session-card').count();
  const scrollsSideways = await page.evaluate(() => document.documentElement.scrollWidth
    > document.documentElement.clientWidth);

  console.log(`${name.padEnd(14)} cards=${String(cards).padEnd(3)} body scrolls sideways=${scrollsSideways}  -> ${file}`);
  if (scrollsSideways) problems.push(`${name}: the page body scrolls horizontally`);

  await page.close();
}

await browser.close();

if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((problem) => console.log(`  ${problem}`));
  process.exit(1);
}
console.log('\nno console errors, no horizontal page scroll');
