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
