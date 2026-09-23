import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
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

  const CAN_HOVER = '(hover: hover)';

  /*
   * Answers true for exactly the queries named, false for every other, and
   * hands back a way to fire that query's own 'change' listener — the one
   * PosterStrip registers on mount to react to the preference flipping mid
   * visit, which a stub that swallows addEventListener could never exercise.
   */
  function matchOnly(...queries) {
    const changeListeners = new Map();

    window.matchMedia = (query) => ({
      matches: queries.includes(query),
      media: query,
      addEventListener: (type, listener) => {
        if (type === 'change') changeListeners.set(query, listener);
      },
      removeEventListener: () => {},
    });

    return {
      fireChange: (query, matches) => changeListeners.get(query)?.({ matches }),
    };
  }

  const reduceMotion = () => matchOnly(REDUCED_MOTION);

  /*
   * setupTests answers false to everything, which is a device that cannot
   * hover — right for the touch case below, wrong for every test about a
   * mouse resting on the strip. Those have to say so.
   */
  const withMouse = () => matchOnly(CAN_HOVER);

  // Shared by both the pause/resume behaviour tests and the countdown ring
  // and touch-hold tests below: all three groups need to find the control
  // by whichever label it currently carries.
  const pauseButton = () => screen.getByRole('button', { name: 'Pausar los afiches' });
  const resumeButton = () => screen.getByRole('button', { name: 'Reanudar los afiches' });

  /*
   * vi.advanceTimersByTime alone does not flush the state update React 18
   * schedules from inside a plain setInterval callback — advance() now also
   * bumps `cycle` for the countdown ring, and that update is batched into a
   * microtask the fake-timer clock does not drain by itself. Wrapping every
   * tick in act() is what makes it land before the assertion right after it,
   * the same guarantee fireEvent already gives for its own events.
   */
  const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  it('advances to the next poster once the interval elapses', () => {
    render(<PosterStrip posters={posters} />);
    const step = layOut({ width: 300, gap: 20 });

    tick(6000);

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

    tick(6000);

    expect(track().scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  /*
   * mouseover/mouseout are what React's onMouseEnter/onMouseLeave actually
   * listen for under the hood; the mouseenter/mouseleave events of the same
   * name do not bubble, and firing those instead would silently test nothing.
   */
  it('does not advance while the pointer is over the strip, and resumes once it leaves', () => {
    withMouse();
    render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });

    fireEvent.mouseOver(track());
    tick(6000);
    expect(track().scrollTo).not.toHaveBeenCalled();

    fireEvent.mouseOut(track());
    tick(6000);
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
    tick(6000);
    expect(track().scrollTo).not.toHaveBeenCalled();

    fireEvent.focusOut(dot);
    tick(6000);
    expect(track().scrollTo).toHaveBeenCalled();
  });

  /*
   * Home never renders an empty strip — it keeps the bundled posters when the
   * API answers with nothing — but the component takes the list as a prop and
   * cannot assume that. With none, the modulo in advance() is a NaN handed to
   * scrollToIndex every six seconds; with one, the timer has nowhere to go.
   */
  it.each([[[]], [[posters[0]]]])('starts no timer for %# poster(s)', (few) => {
    render(<PosterStrip posters={few} />);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('never starts when the visitor asked for less motion', () => {
    reduceMotion();
    render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });

    tick(6000);

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

  /*
   * stopAutoplay only ever clears the id it last stored, so a second start
   * would strand the interval underneath it — ticking on unreferenced, and
   * beyond the reach of the unmount above. Nothing observable goes wrong on
   * the first extra one, which is why this counts timers rather than scrolls.
   */
  it('never stacks a second interval on top of a running one', () => {
    withMouse();
    const { container } = render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });
    const strip = container.querySelector('.poster-strip');

    fireEvent.mouseOut(strip);
    fireEvent.mouseOut(strip);
    fireEvent.mouseOut(strip);

    expect(vi.getTimerCount()).toBe(1);
  });

  /*
   * A finger landing on the strip emits an emulated mouseover and then no
   * mouseout at all, so a hold taken on hover was never lifted: one tap and
   * the posters stopped for the rest of the visit, on a phone, which is what
   * most of these visitors are on. Verified against a real touch context
   * before this test existed — autoplay ran, one tap, and it never moved
   * again.
   */
  it('keeps going after a tap on a device that cannot hover', () => {
    const { container } = render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });
    const strip = container.querySelector('.poster-strip');

    fireEvent.mouseOver(strip);
    tick(6000);

    expect(track().scrollTo).toHaveBeenCalled();
  });

  /*
   * The pointer leaving and the focus leaving are separate permissions to
   * resume, and one cannot speak for the other. Someone tabbing through the
   * dots whose mouse happens to drift off the strip had the slideshow start
   * again underneath them — the exact thing pausing on focus was for.
   */
  it('stays paused when the pointer leaves but the focus is still inside', () => {
    withMouse();
    const { container } = render(<PosterStrip posters={posters} />);
    layOut({ width: 300, gap: 20 });
    const strip = container.querySelector('.poster-strip');

    fireEvent.focusIn(strip);
    fireEvent.mouseOut(strip);

    expect(vi.getTimerCount()).toBe(0);

    fireEvent.focusOut(strip);

    expect(vi.getTimerCount()).toBe(1);
  });

  /*
   * WCAG 2.2.2 (Pause, Stop, Hide): anything that moves on its own for more
   * than five seconds needs a way to stop it that does not depend on a
   * pointer resting somewhere or a moment of focus, because a screen-reader
   * user or a switch-access visitor has neither. This is that control.
   */
  describe('the pause and resume control', () => {
    it('is offered once autoplay can run', () => {
      render(<PosterStrip posters={posters} />);

      expect(pauseButton()).toBeInTheDocument();
    });

    it('stops autoplay when pressed, and its own label becomes the resume one', () => {
      render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });

      fireEvent.click(pauseButton());
      tick(6000);
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
      expect(resumeButton()).toBeInTheDocument();
    });

    /*
     * The user's own pause is a distinct hold ('user'), sticky on top of the
     * implicit ones. Hovering off, or focus leaving, only lifts the hold that
     * gesture itself took — release() re-checks holds.size before restarting,
     * so 'user' sitting underneath keeps autoplay stopped either way.
     */
    it('is not undone by the pointer resting on the strip and then leaving', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.click(pauseButton());
      fireEvent.mouseOver(strip);
      fireEvent.mouseOut(strip);
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
    });

    it('is not undone by focus entering the strip and then leaving', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.click(pauseButton());
      fireEvent.focusIn(strip);
      fireEvent.focusOut(strip);
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
    });

    /*
     * Resume is an explicit instruction, unlike the implicit holds. By the
     * time this click is handled, the mouse already resting on the strip and
     * the focus landing on this very button have both taken their own holds
     * — so resuming has to clear 'pointer' and 'focus' along with 'user', or
     * the slideshow would stay stopped for reasons the visitor never chose.
     */
    it('resumes immediately even though the pointer rests on the strip and focus is on the button itself', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      const step = layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.mouseOver(strip);
      fireEvent.focusIn(pauseButton());
      fireEvent.click(pauseButton());

      fireEvent.focusIn(resumeButton());
      fireEvent.click(resumeButton());
      tick(6000);

      expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
    });

    it('still holds autoplay when a dot is focused again after a resume', () => {
      render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });

      fireEvent.click(pauseButton());
      fireEvent.click(resumeButton());

      const dot = screen.getByRole('button', { name: 'Ver el afiche 1 de 3' });
      fireEvent.focusIn(dot);
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
    });

    // The label is the user's own choice, not a readout of every implicit
    // hold — a mouse passing over the strip is not something they asked for.
    it('does not change its label just because the pointer is hovering', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.mouseOver(strip);

      expect(pauseButton()).toBeInTheDocument();
    });

    // Nothing autoplays under reduced motion, so there is nothing to offer a
    // pause for.
    it('is not rendered at all when the visitor prefers reduced motion', () => {
      reduceMotion();
      render(<PosterStrip posters={posters} />);

      expect(screen.queryByRole('button', { name: 'Pausar los afiches' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reanudar los afiches' })).not.toBeInTheDocument();
    });

    it('is not rendered with a single poster', () => {
      render(<PosterStrip posters={[posters[0]]} />);

      expect(screen.queryByRole('button', { name: 'Pausar los afiches' })).not.toBeInTheDocument();
    });

    /*
     * The preference can flip mid-visit, same as autoplay itself already
     * reacts to it. A user pause taken before the flip has to survive it: the
     * control disappearing under reduced motion must not read as "resumed".
     */
    it('comes back still paused, labelled to resume, after reduced motion turns on and off again', () => {
      const media = matchOnly();
      render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });

      fireEvent.click(pauseButton());

      act(() => { media.fireChange(REDUCED_MOTION, true); });
      expect(screen.queryByRole('button', { name: /los afiches$/ })).not.toBeInTheDocument();

      act(() => { media.fireChange(REDUCED_MOTION, false); });
      expect(resumeButton()).toBeInTheDocument();

      tick(6000);
      expect(track().scrollTo).not.toHaveBeenCalled();
    });

    // A device that cannot hover never takes the 'pointer' hold at all
    // (holdPointer guards on hoverQuery.matches), so a tap has to rely purely
    // on the sticky 'user' one to stay paused.
    it('stays paused after a tap on a device that cannot hover', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.click(pauseButton());
      fireEvent.mouseOver(strip);
      fireEvent.mouseOut(strip);
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
    });
  });

  /*
   * The product owner found the dark filled button "unnatural" sitting among
   * the dots: this redraws the same control (same element, same labels, same
   * toggleUserPause logic — none of the tests above changed) as a thin ring
   * that fills over the six-second interval instead. data-running is what
   * lets the CSS freeze that fill on the same holds the timer itself already
   * checks, rather than recomputing "is it paused" a second way in CSS.
   */
  describe('the countdown ring', () => {
    const ring = (container) => container.querySelector('.poster-strip__ring-progress');

    it('restarts on every tick, not only when the timer first starts', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const ringBefore = ring(container);

      tick(6000);

      expect(ring(container)).not.toBe(ringBefore);
    });

    it('is marked running once autoplay starts', () => {
      render(<PosterStrip posters={posters} />);

      expect(pauseButton()).toHaveAttribute('data-running', 'true');
    });

    it('is marked not running while the pointer hovers, and running again once it leaves', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.mouseOver(strip);
      expect(pauseButton()).toHaveAttribute('data-running', 'false');

      fireEvent.mouseOut(strip);
      expect(pauseButton()).toHaveAttribute('data-running', 'true');
    });

    it('is marked not running while focus is inside, and running again once it leaves', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.focusIn(strip);
      expect(pauseButton()).toHaveAttribute('data-running', 'false');

      fireEvent.focusOut(strip);
      expect(pauseButton()).toHaveAttribute('data-running', 'true');
    });

    it('is marked not running while a finger is down, and running again once it lifts', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.pointerDown(strip, { pointerType: 'touch' });
      expect(pauseButton()).toHaveAttribute('data-running', 'false');

      fireEvent.pointerUp(strip, { pointerType: 'touch' });
      expect(pauseButton()).toHaveAttribute('data-running', 'true');
    });

    it('is marked not running after a user pause, and running again after resume', () => {
      render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });

      fireEvent.click(pauseButton());
      expect(resumeButton()).toHaveAttribute('data-running', 'false');

      fireEvent.click(resumeButton());
      expect(pauseButton()).toHaveAttribute('data-running', 'true');
    });

    // "Tap to resume" only makes sense once the visitor is the reason it is
    // paused — a mouse merely resting on the strip is not a choice to show a
    // glyph for, and the ring alone already says the timer is held.
    it('shows the play glyph only when paused by the user, not merely by a hovering pointer', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.mouseOver(strip);
      expect(container.querySelector('.poster-strip__play')).not.toBeInTheDocument();

      fireEvent.mouseOut(strip);
      fireEvent.click(pauseButton());
      expect(container.querySelector('.poster-strip__play')).toBeInTheDocument();
    });

    /*
     * A timer that restarts runs a full six seconds, so the ring has to start
     * from empty with it. Left frozen part-way, it would finish early and sit
     * full while the posters stayed put.
     */
    it('restarts from empty once a hold lifts, not only on a tick', () => {
      withMouse();
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.mouseOver(strip);
      const ringWhileHeld = ring(container);
      fireEvent.mouseOut(strip);

      expect(ring(container)).not.toBe(ringWhileHeld);
    });

    it('restarts from empty on resume', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });

      fireEvent.click(pauseButton());
      const ringWhilePaused = ring(container);
      fireEvent.click(resumeButton());

      expect(ring(container)).not.toBe(ringWhilePaused);
    });
  });

  /*
   * WCAG 2.2.2 needs a way to stop the motion that does not depend on a
   * pointer that can hover, and a touch screen is exactly that visitor: it
   * has no hover to hold on, only a finger that is either down or not.
   */
  describe('holding the strip with a finger or pen', () => {
    it('stops advancing while a touch pointer is down, and resumes once it lifts', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      const step = layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.pointerDown(strip, { pointerType: 'touch' });
      tick(6000);
      expect(track().scrollTo).not.toHaveBeenCalled();

      fireEvent.pointerUp(strip, { pointerType: 'touch' });
      tick(6000);
      expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
    });

    /*
     * A swipe never reaches pointerup on the element it started on — the
     * browser takes the gesture over for scrolling and fires pointercancel
     * instead — so the hold has to lift on cancel too, or every swipe would
     * silently stop autoplay for the rest of the visit.
     */
    it('also resumes on pointercancel, the event a swipe actually ends in', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      const step = layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.pointerDown(strip, { pointerType: 'touch' });
      fireEvent.pointerCancel(strip, { pointerType: 'touch' });
      tick(6000);

      expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
    });

    it('does not hold for a mouse pointer, even on a device that cannot hover', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      const step = layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.pointerDown(strip, { pointerType: 'mouse' });
      tick(6000);

      expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
    });

    it('does not resume a sticky user pause', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.click(pauseButton());
      fireEvent.pointerDown(strip, { pointerType: 'touch' });
      fireEvent.pointerUp(strip, { pointerType: 'touch' });
      tick(6000);

      expect(track().scrollTo).not.toHaveBeenCalled();
    });

    // The same implicit-holds-taken-by-this-very-gesture problem the pointer
    // and focus holds already had on resume: a tap on the resume button
    // lands a pointerdown on the strip before the click is handled.
    it('resumes immediately even though a finger is still down when the resume button is tapped', () => {
      const { container } = render(<PosterStrip posters={posters} />);
      const step = layOut({ width: 300, gap: 20 });
      const strip = container.querySelector('.poster-strip');

      fireEvent.click(pauseButton());
      fireEvent.pointerDown(strip, { pointerType: 'touch' });
      fireEvent.click(resumeButton());
      tick(6000);

      expect(track().scrollTo).toHaveBeenCalledWith({ left: step, behavior: 'smooth' });
    });
  });
});
