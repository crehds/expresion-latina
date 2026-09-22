import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PosterStrip from './PosterStrip';

const posters = [
  { id: 'a', filename: 'Afiche A', url: 'https://example.test/a.jpg' },
  { id: 'b', filename: 'Afiche B', url: 'https://example.test/b.jpg' },
  { id: 'c', filename: 'Afiche C', url: 'https://example.test/c.jpg' },
];

const track = () => screen.getByRole('list');

/*
 * jsdom lays nothing out: getBoundingClientRect is always zeroed and
 * scrollTo/scrollBy don't exist on an element at all. Stubbing them is what
 * turns "did the strip ask to scroll" into something a test can assert on,
 * instead of asserting on motion jsdom never produces.
 *
 * Put back by hand afterwards. vi.spyOn cannot stand in here — it refuses a
 * property the object does not already have, and jsdom defines neither — so
 * these are plain assignments, which restoreAllMocks knows nothing about and
 * would leave on the prototype for every suite that follows.
 */
const SCROLL_METHODS = ['scrollTo', 'scrollBy'];
let originalScrollMethods;

beforeEach(() => {
  originalScrollMethods = SCROLL_METHODS.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(Element.prototype, name),
  ]);

  SCROLL_METHODS.forEach((name) => {
    Element.prototype[name] = vi.fn();
  });
});

afterEach(() => {
  originalScrollMethods.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    else delete Element.prototype[name];
  });

  vi.restoreAllMocks();
});

/**
 * Lays the posters out at a fixed pitch, the way a browser would.
 *
 * The component measures the distance between two items rather than trusting
 * the track's width, because the flex gap sits between them. jsdom reports
 * zero for all of it, so the positions have to be supplied for any of that to
 * be observable.
 */
function layOut({ width, gap }) {
  Object.defineProperty(track(), 'clientWidth', { value: width, configurable: true });

  screen.getAllByRole('listitem').forEach((item, index) => {
    Object.defineProperty(item, 'getBoundingClientRect', {
      value: () => ({ left: index * (width + gap), width }),
      configurable: true,
    });
  });

  return width + gap;
}

/*
 * One dot per poster is the whole point of the indicator. Fewer and a poster
 * has no dot to select it directly; more and the row lies about how many
 * there are to see.
 */
it('renders one dot per poster', () => {
  render(<PosterStrip posters={posters} />);

  expect(screen.getAllByRole('button', { name: /^Ver el afiche \d de 3$/ })).toHaveLength(3);
});

it('marks the first poster current on mount, and no other', () => {
  render(<PosterStrip posters={posters} />);

  expect(screen.getByRole('button', { name: 'Ver el afiche 1 de 3', current: true }))
    .toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver el afiche 2 de 3' }))
    .not.toHaveAttribute('aria-current');
});

/*
 * The gap between posters is why the step is measured. A click that moved by
 * the track's width alone would land short by one gap per poster passed, and
 * it is only scroll-snap that would hide it.
 */
it('scrolls the track to the poster whose dot was clicked, gap included', async () => {
  render(<PosterStrip posters={posters} />);
  const step = layOut({ width: 300, gap: 20 });

  await userEvent.click(screen.getByRole('button', { name: 'Ver el afiche 3 de 3' }));

  expect(track().scrollTo).toHaveBeenCalledWith({ left: step * 2, behavior: 'smooth' });
});

/*
 * A swipe never touches a dot, so the dots only stay honest if the track's
 * own scroll position is read back rather than only updated from a click.
 */
it('moves the current dot when the track itself scrolls', () => {
  render(<PosterStrip posters={posters} />);
  const step = layOut({ width: 300, gap: 20 });
  Object.defineProperty(track(), 'scrollLeft', { value: step * 2, configurable: true });

  fireEvent.scroll(track());

  expect(screen.getByRole('button', { name: 'Ver el afiche 3 de 3', current: true }))
    .toBeInTheDocument();
});

/*
 * The drift the measured step exists to prevent: dividing a real scroll
 * position by the track's width alone gains a gap's worth of error per
 * poster, and once that passes half a poster the wrong dot lights up. At
 * three posters it would still round right, which is exactly why this asserts
 * the far end rather than the near one.
 */
it('marks the right dot at the far end, where a width-only step would drift', () => {
  const many = Array.from({ length: 12 }, (unused, index) => ({
    id: `p${index}`,
    filename: `Afiche ${index}`,
    url: `https://example.test/${index}.jpg`,
  }));

  render(<PosterStrip posters={many} />);
  const step = layOut({ width: 300, gap: 20 });
  Object.defineProperty(track(), 'scrollLeft', { value: step * 11, configurable: true });

  fireEvent.scroll(track());

  expect(screen.getByRole('button', { name: 'Ver el afiche 12 de 12', current: true }))
    .toBeInTheDocument();
});

/*
 * The arrows are the pointer's own affordance and are not changing here, but
 * nothing pinned them before this file — a regression here would previously
 * have gone unnoticed until someone reached for a mouse.
 */
describe('the desktop arrows', () => {
  it('still move the track by one poster, in the direction pressed', async () => {
    render(<PosterStrip posters={posters} />);
    const step = layOut({ width: 300, gap: 20 });

    await userEvent.click(screen.getByRole('button', { name: 'Ver el siguiente' }));
    expect(track().scrollBy).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });

    await userEvent.click(screen.getByRole('button', { name: 'Ver el anterior' }));
    expect(track().scrollBy).toHaveBeenCalledWith({ left: -step, behavior: 'smooth' });
  });
});

/*
 * Autoplay is the one behaviour here with a real failure mode: a poster
 * sliding away under a visitor who is still reading it, or a timer nobody
 * asked for still spinning after the strip is gone. Fake timers make the
 * six-second wait instant.
 *
 * setupTests stubs matchMedia to always answer false, which is right for
 * every other suite but wrong for the one test below that needs a visitor
 * who asked for less motion. That one saves and restores window.matchMedia
 * itself, the same disciplined way this file already restores the scroll
 * methods, so the override never leaks into another test.
 */
describe('autoplay', () => {
  const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
  let realMatchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    realMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });

  function reduceMotion() {
    window.matchMedia = (query) => ({
      matches: query === REDUCED_MOTION,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  it('advances to the next poster once the interval elapses', () => {
    render(<PosterStrip posters={posters} />);
    const step = layOut({ width: 300, gap: 20 });

    vi.advanceTimersByTime(6000);

    expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
  });

  /*
   * A strip that stops at the last poster is a dead end rather than a loop.
   * Wrapping through scrollToIndex, instead of a second distance
   * calculation, is what keeps the measured step the only place that
   * distance is ever computed.
   */
  it('wraps from the last poster back to the first', () => {
    render(<PosterStrip posters={posters} />);
    const step = layOut({ width: 300, gap: 20 });
    Object.defineProperty(track(), 'scrollLeft', { value: step * 2, configurable: true });
    fireEvent.scroll(track());

    vi.advanceTimersByTime(6000);

    expect(track().scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  /*
   * mouseover/mouseout are what React's onMouseEnter/onMouseLeave actually
   * listen for under the hood; the mouseenter/mouseleave events of the same
   * name do not bubble, and firing those instead would silently test nothing.
   */
  it('does not advance while the pointer is over the strip, and resumes once it leaves', () => {
    render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });

    fireEvent.mouseOver(track());
    vi.advanceTimersByTime(6000);
    expect(track().scrollTo).not.toHaveBeenCalled();

    fireEvent.mouseOut(track());
    vi.advanceTimersByTime(6000);
    expect(track().scrollTo).toHaveBeenCalled();
  });

  /*
   * Same trap as the hover case: React's onFocus/onBlur are wired to the
   * native focusin/focusout events, not focus/blur, because only the former
   * pair bubbles.
   */
  it('does not advance while a dot inside the strip is focused, and resumes once focus leaves', () => {
    render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });
    const dot = screen.getByRole('button', { name: 'Ver el afiche 1 de 3' });

    fireEvent.focusIn(dot);
    vi.advanceTimersByTime(6000);
    expect(track().scrollTo).not.toHaveBeenCalled();

    fireEvent.focusOut(dot);
    vi.advanceTimersByTime(6000);
    expect(track().scrollTo).toHaveBeenCalled();
  });

  it('never starts when the visitor asked for less motion', () => {
    reduceMotion();
    render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });

    vi.advanceTimersByTime(6000);

    expect(track().scrollTo).not.toHaveBeenCalled();
  });

  /*
   * The interval lives outside React, so a missed clearInterval would not
   * throw — it would just keep firing into a strip that no longer exists. A
   * scrollTo assertion can't catch that here: the ref callback already nulls
   * this.strip on unmount, and scrollToIndex quietly no-ops on a null ref
   * regardless of whether the interval itself was ever cleared. Counting the
   * live fake timers is what actually proves the teardown ran.
   */
  it('clears the interval on unmount', () => {
    const { unmount } = render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
