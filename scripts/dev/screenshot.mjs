/*
 * Callbacks passed to page.evaluate are serialised and run inside the
 * browser, not in Node, so document is defined where they execute.
 */
/* global document, getComputedStyle */
// Drives the running dev server in a real browser and captures the viewports
// that matter. Jest renders through jsdom, which has no layout engine at all,
// so nothing there can tell us whether a grid or a chip row actually looks right.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2] ?? 'http://localhost:3000/schedules';
const outDir = process.argv[3] ?? 'screenshots';

// The root element each page renders: the landing page, or the shared Page
// frame every other route sits in. Waiting on one of these proves a lazy
// route actually mounted.
const PAGE_ROOTS = '.home, .page';

const KNOWN_THIRD_PARTY_WARNINGS = [
  /Support for defaultProps will be removed/,
];

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

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // React logs deprecations through console.error. nuka-carousel 5 still
    // uses defaultProps on a function component; the fix is its v8 major,
    // not anything in this repository, and failing every run on it would
    // teach us to stop reading the output.
    if (KNOWN_THIRD_PARTY_WARNINGS.some((pattern) => pattern.test(m.text()))) return;
    problems.push(`${name}: ${m.text()}`);
  });
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

    // Naming what sticks out turns "the page scrolls sideways" into something
    // that can be fixed without hunting through the DOM by hand.
    const limit = document.documentElement.clientWidth;
    const overflowing = [...document.querySelectorAll('body *')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      // Fixed elements anchor to the visual viewport, so once anything else
      // has widened the page they all appear to stick out. Reporting them
      // buries the element that actually caused it.
      .filter(({ element }) => getComputedStyle(element).position !== 'fixed')
      .filter(({ box }) => box.width > 0 && (box.right > limit + 1 || box.left < -1))
      .map(({ element, box }) => `${element.tagName.toLowerCase()}`
        + `${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`
        + ` (${Math.round(box.left)}..${Math.round(box.right)} of ${limit})`)
      .slice(0, 4);

    /*
     * The page root is a grid item of a 1fr row, so it stretches to the window
     * and its own bottom says nothing about where the content ends. Measure the
     * last thing inside it instead.
     */
    const pageRoot = document.querySelector(roots);
    const lastChildBottom = pageRoot?.lastElementChild
      ? Math.round(pageRoot.lastElementChild.getBoundingClientRect().bottom)
      : null;

    /*
     * The page frame declares its own bottom padding, which is breathing room
     * the design asked for rather than a hole to fall through. Counting it as
     * dead space failed every page by exactly that padding.
     */
    const surface = document.querySelector('.App > *:nth-child(2)');
    const surfacePadding = surface
      ? parseFloat(getComputedStyle(surface).paddingBottom) || 0
      : 0;

    return {
      overflowing,
      scrollsSideways: document.documentElement.scrollWidth
        > document.documentElement.clientWidth,
      contentBottom: bottomOf('.week-columns') ?? bottomOf('.day-agenda')
        ?? lastChildBottom,
      surfaceBottom: surface
        ? Math.round(surface.getBoundingClientRect().bottom - surfacePadding)
        : null,
      /*
       * The page footer by its class, not by its tag. A <footer> is legitimate
       * inside an <article> or a <blockquote> — a review card carries one for
       * its author — and matching the tag picked the first of those instead,
       * reporting the distance to it as an overlap on a page that had none.
       */
      footerTop: topOf('.footer'),
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

  if (scrollsSideways) {
    const culprits = layout.overflowing.length
      ? layout.overflowing.join('; ')
      : 'no element found past the viewport edge';
    problems.push(`${name}: the page body scrolls horizontally — ${culprits}`);
  }

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
