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

// The root element each page renders. Waiting on one of these proves a
// lazy route actually mounted.
const PAGE_ROOTS = '.home, .teachers, .dance-genres, .schedules, .reviews, .contact';

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

  // Every page is behind React.lazy, so wait for a page to have mounted. The
  // app shell is not enough: its header renders immediately, so waiting on it
  // lets the screenshot and every measurement below run against a page that
  // has not arrived yet.
  await page.waitForSelector(PAGE_ROOTS, { timeout: 10000 });

  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });

  const cards = await page.locator('.session-card').count();

  const layout = await page.evaluate((roots) => {
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
        ?? bottomOf(roots),
      surfaceBottom: bottomOf('.App > *:nth-child(2)'),
      footerTop: topOf('footer'),
      viewportHeight: document.documentElement.clientHeight,
    };
  }, PAGE_ROOTS);

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

  // A measurement that could not be taken is a failure, not a pass. Comparing
  // null with `>` is false, so without this branch an unmeasurable page —
  // content that never mounted, a missing footer — reports clean and the
  // checks below prove nothing.
  if (deadSpace === null || overlap === null) {
    problems.push(`${name}: could not measure the layout; the page content or footer was not found`);
  } else {
    if (overlap > 0) problems.push(`${name}: content overlaps the footer by ${overlap}px`);
    if (deadSpace > 24) problems.push(`${name}: ${deadSpace}px of empty page you have to scroll to reach`);
  }

  await page.close();
}

await browser.close();

if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((problem) => console.log(`  ${problem}`));
  process.exit(1);
}
console.log('\nno console errors, no horizontal page scroll');
