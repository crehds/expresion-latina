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
  // Short and wide: a laptop and a phone held sideways. A layout that gives
  // the content a fixed share of the viewport height looks fine on a tall
  // screen and collides with the footer here.
  { name: 'laptop-1280x600', width: 1280, height: 600 },
  { name: 'landscape-740x360', width: 740, height: 360 },
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
  await page.waitForSelector('.App > *', { timeout: 10000 });

  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });

  const cards = await page.locator('.session-card').count();

  const layout = await page.evaluate(() => {
    const bottomOf = (selector) => {
      const element = document.querySelector(selector);
      return element ? Math.round(element.getBoundingClientRect().bottom) : null;
    };
    const topOf = (selector) => {
      const element = document.querySelector(selector);
      return element ? Math.round(element.getBoundingClientRect().top) : null;
    };

    return {
      scrollsSideways: document.documentElement.scrollWidth
        > document.documentElement.clientWidth,
      contentBottom: bottomOf('.week-columns') ?? bottomOf('.day-agenda')
        ?? bottomOf('.teachers') ?? bottomOf('.dance-genres') ?? bottomOf('.contact')
        ?? bottomOf('.home') ?? bottomOf('.reviews'),
      surfaceBottom: bottomOf('.App > *:nth-child(2)'),
      footerTop: topOf('footer'),
      viewportHeight: document.documentElement.clientHeight,
    };
  });

  const { scrollsSideways, contentBottom, surfaceBottom } = layout;
  // Empty page the visitor has to scroll to reach. Page surface that merely
  // fills the window below short content is the ordinary result of keeping
  // the footer at the bottom, and is not a defect.
  const deadSpace = contentBottom === null || surfaceBottom === null
    ? null : Math.max(0, surfaceBottom - Math.max(contentBottom, layout.viewportHeight));
  // Content running past where the footer starts means they are drawn on top
  // of each other.
  const overlap = contentBottom === null || layout.footerTop === null
    ? null : contentBottom - layout.footerTop;

  console.log(
    `${name.padEnd(18)} cards=${String(cards).padEnd(3)} `
    + `dead-space=${String(deadSpace).padEnd(5)} `
    + `footer-overlap=${String(overlap).padEnd(5)} `
    + `sideways=${scrollsSideways}  -> ${file}`,
  );

  if (scrollsSideways) problems.push(`${name}: the page body scrolls horizontally`);
  if (overlap > 0) problems.push(`${name}: content overlaps the footer by ${overlap}px`);
  if (deadSpace > 24) problems.push(`${name}: ${deadSpace}px of empty page you have to scroll to reach`);

  await page.close();
}

await browser.close();

if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((problem) => console.log(`  ${problem}`));
  process.exit(1);
}
console.log('\nno console errors, no horizontal page scroll');
