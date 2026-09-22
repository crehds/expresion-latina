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
 */
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollBy = vi.fn();
});

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

it('scrolls the track to the poster whose dot was clicked', async () => {
  render(<PosterStrip posters={posters} />);
  // The track's own width is what one slide measures now that a slide is
  // 100% of it, so the third poster sits three widths in.
  Object.defineProperty(track(), 'clientWidth', { value: 300, configurable: true });

  await userEvent.click(screen.getByRole('button', { name: 'Ver el afiche 3 de 3' }));

  expect(track().scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' });
});

/*
 * A swipe never touches a dot, so the dots only stay honest if the track's
 * own scroll position is read back rather than only updated from a click.
 */
it('moves the current dot when the track itself scrolls', () => {
  render(<PosterStrip posters={posters} />);
  Object.defineProperty(track(), 'clientWidth', { value: 300, configurable: true });
  Object.defineProperty(track(), 'scrollLeft', { value: 600, configurable: true });

  fireEvent.scroll(track());

  expect(screen.getByRole('button', { name: 'Ver el afiche 3 de 3', current: true }))
    .toBeInTheDocument();
});

/*
 * The arrows are the pointer's own affordance and are not changing here, but
 * nothing pinned them before this file — a regression here would previously
 * have gone unnoticed until someone reached for a mouse.
 */
describe('the desktop arrows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still move the track by one card, in the direction pressed', async () => {
    render(<PosterStrip posters={posters} />);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300 });

    await userEvent.click(screen.getByRole('button', { name: 'Ver el siguiente' }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });

    await userEvent.click(screen.getByRole('button', { name: 'Ver el anterior' }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledWith({ left: -300, behavior: 'smooth' });
  });
});
