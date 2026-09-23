import { Component } from 'react';
import PropTypes from 'prop-types';

import Poster from './Poster';

import '../css/poster-strip.css';

// Long enough to read a poster; short enough that the row still feels alive.
const AUTOPLAY_INTERVAL_MS = 6000;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/*
 * Whether the pointer can actually rest on something without pressing it.
 *
 * A touch screen emits an emulated mouseover when a finger lands and usually
 * no mouseout at all, so holding autoplay on hover left the hold set forever:
 * one tap anywhere on the strip and the posters never moved again, on the
 * device most of these visitors are using. A device that cannot hover cannot
 * hold by hovering.
 */
const CAN_HOVER = '(hover: hover)';

/**
 * The academy's posters, as a strip you scroll rather than a carousel.
 *
 * This replaces nuka-carousel. The library sized its own track wider than the
 * page — 600px inside a 360px phone — which is what made every page draggable
 * sideways, and it gave a phone arrow buttons where a thumb wants a swipe.
 * Native scroll-snap is the gesture people already have, costs no dependency,
 * and keeps the arrows for the desktop pointer that has no swipe.
 */
class PosterStrip extends Component {
  constructor(props) {
    super(props);

    this.reducedMotionQuery = window.matchMedia(REDUCED_MOTION);
    this.hoverQuery = window.matchMedia(CAN_HOVER);

    /*
     * Every reason autoplay is currently held, not merely that it is.
     *
     * A pointer resting on the strip and the keyboard focus sitting inside it
     * are independent: collapsing them into one flag let a mouse wandering
     * out of the area restart the slideshow under a visitor who was still
     * tabbing through the dots.
     */
    this.holds = new Set();

    this.state = {
      currentIndex: 0,
      // Read once here for the first render; the change listener below keeps
      // it current for the rest of the visit.
      prefersReducedMotion: this.reducedMotionQuery.matches,
      // Drives only the pause/resume button's own label. It is deliberately
      // not read from this.holds: the implicit pointer/focus holds come and
      // go on their own, and a label that echoed them would flip every time
      // a mouse merely passed over the strip.
      userPaused: false,
      // Whether the timer is actually ticking, independent of why it might
      // not be: the ring freezes on this rather than re-deriving "paused"
      // from holds a second time in CSS.
      running: false,
      // Bumped every time a fresh six seconds begins — on the timer
      // (re)starting and on every tick — and used as the progress circle's
      // key so it remounts and its fill animation restarts from empty.
      cycle: 0,
    };
  }

  componentDidMount() {
    this.reducedMotionQuery.addEventListener('change', this.handleReducedMotionChange);
    this.startAutoplay();
  }

  // stopAutoplay sets state on its way out, which React 18 simply drops for
  // a component being unmounted.
  componentWillUnmount() {
    this.reducedMotionQuery.removeEventListener('change', this.handleReducedMotionChange);
    this.stopAutoplay();
  }

  // A visitor can flip this preference mid-visit, not only before the page
  // loads, so autoplay has to react to it rather than check it once at mount.
  // The state update is what lets the pause/resume button itself appear and
  // disappear with the preference, on top of the timer reacting to it.
  handleReducedMotionChange = (event) => {
    this.setState({ prefersReducedMotion: event.matches });

    if (event.matches) this.stopAutoplay();
    else this.startAutoplay();
  };

  /**
   * The distance from one poster to the next, measured rather than assumed.
   *
   * A slide is the full width of the track, so the track's own width looks
   * like the step — but the flex gap sits between them, leaving every jump
   * short by one gap per poster passed. Snapping hides that on the way there;
   * the index read back out of scrollLeft is what drifts, and far enough
   * along it rounds to the wrong dot. Reading two items settles it, and it is
   * the one measurement both the arrows and the dots move by.
   */
  step = () => {
    const items = this.strip.querySelectorAll('.poster-strip__item');

    if (items.length > 1) {
      const [first, second] = items;
      return second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    }

    return this.strip.clientWidth;
  };

  /*
   * Every reason not to run, in one guard.
   *
   * The timer check is what stops a second start stacking an interval on top
   * of the first: stopAutoplay only ever clears the id it last stored, so the
   * one underneath would tick on unreferenced for the life of the page.
   */
  startAutoplay = () => {
    const { posters } = this.props;

    // One poster has nowhere to advance to, and none at all would make the
    // modulo in advance() hand scrollToIndex a NaN every six seconds.
    if (posters.length < 2) return;
    if (this.autoplayTimer || this.holds.size || this.reducedMotionQuery.matches) return;

    this.autoplayTimer = setInterval(this.advance, AUTOPLAY_INTERVAL_MS);
    // A fresh interval is a fresh six seconds: bumping cycle remounts the
    // progress circle so its fill animation restarts from empty instead of
    // picking up wherever a stale node's animation happened to be.
    this.setState((state) => ({ running: true, cycle: state.cycle + 1 }));
  };

  hold = (reason) => {
    this.holds.add(reason);
    this.stopAutoplay();
  };

  // The hold a touch screen would never lift again, so it is never taken.
  holdPointer = () => {
    if (this.hoverQuery.matches) this.hold('pointer');
  };

  /*
   * A swipe ends in pointercancel the moment the browser takes the gesture
   * over for scrolling, so that hold lifts on its own and a fresh cycle
   * begins for whichever poster the swipe lands on — nothing left to pause
   * for. A long press that never turns into a swipe stays a pointerdown with
   * no matching up or cancel yet, which is exactly a visitor holding still
   * to read the poster under their finger, the touch equivalent of a mouse
   * resting on the strip.
   */
  holdTouch = (event) => {
    if (event.pointerType !== 'mouse') this.hold('touch');
  };

  release = (reason) => {
    this.holds.delete(reason);
    this.startAutoplay();
  };

  /*
   * The visitor's own pause/resume instruction, required by WCAG 2.2.2 as a
   * way to stop the motion that does not depend on where a pointer happens
   * to rest or which element happens to have focus — the two other holds
   * this component already has, neither of which a screen-reader or
   * switch-access visitor can produce on demand.
   *
   * Pausing is just another hold: 'user' sits alongside 'pointer', 'focus'
   * and 'touch' in the same set, so a mouse leaving, focus moving or a
   * finger lifting afterwards still finds holds.size > 0 and correctly
   * refuses to restart the timer. That stickiness falls out of the existing
   * hold/release machinery for free; nothing here has to know about the
   * other three reasons.
   *
   * Resuming is different on purpose: it is an explicit instruction, not the
   * absence of one, so it clears 'pointer', 'focus' and 'touch' as well as
   * 'user' before starting the timer. By the time this handler runs, the
   * very gesture that reached the button — a pointer resting on the strip,
   * focus landing on the button itself, a finger tapping it — has usually
   * already taken one of those three holds; leaving it in place would make
   * "resume" silently do nothing on the exact device it needs to work on.
   * They are taken again by the next genuine mouseenter, focus or
   * pointerdown event, the same way they always were.
   */
  toggleUserPause = () => {
    const { userPaused } = this.state;

    if (userPaused) {
      this.holds.delete('user');
      this.holds.delete('pointer');
      this.holds.delete('focus');
      this.holds.delete('touch');
      this.setState({ userPaused: false });
      this.startAutoplay();
    } else {
      this.hold('user');
      this.setState({ userPaused: true });
    }
  };

  stopAutoplay = () => {
    clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
    this.setState({ running: false });
  };

  // Reuses scrollToIndex rather than a second distance calculation, and
  // wraps past the last poster back to the first instead of stopping there.
  advance = () => {
    const { posters } = this.props;
    const { currentIndex } = this.state;

    this.scrollToIndex((currentIndex + 1) % posters.length);
    // Every tick is also the start of the next six seconds, so the ring has
    // to restart here too, not only when the timer itself is (re)created.
    this.setState((state) => ({ cycle: state.cycle + 1 }));
  };

  scrollBy = (direction) => {
    if (!this.strip) return;

    this.strip.scrollBy({ left: this.step() * direction, behavior: 'smooth' });
  };

  scrollToIndex = (index) => {
    if (!this.strip) return;

    this.strip.scrollTo({ left: this.step() * index, behavior: 'smooth' });
  };

  // The dots have no state of their own: reading the track's scroll position
  // back is what keeps them correct after a swipe, not only after a click.
  handleScroll = () => {
    if (!this.strip) return;

    const step = this.step();
    if (!step) return;

    this.setState({ currentIndex: Math.round(this.strip.scrollLeft / step) });
  };

  render() {
    const { posters } = this.props;
    const {
      currentIndex, prefersReducedMotion, userPaused, running, cycle,
    } = this.state;

    // Nothing to offer a pause for when autoplay itself will never run: a
    // single poster has nowhere to advance to, and reduced motion already
    // keeps the timer off. Matches startAutoplay's own guard, so the button
    // never claims control over motion that was never going to happen.
    const canAutoplay = posters.length > 1 && !prefersReducedMotion;

    return (
      <div
        className="poster-strip"
        onMouseEnter={this.holdPointer}
        onMouseLeave={() => this.release('pointer')}
        onFocus={() => this.hold('focus')}
        onBlur={() => this.release('focus')}
        onPointerDown={this.holdTouch}
        onPointerUp={() => this.release('touch')}
        onPointerCancel={() => this.release('touch')}
      >
        <button
          type="button"
          className="poster-strip__arrow poster-strip__arrow--prev"
          onClick={() => this.scrollBy(-1)}
          aria-label="Ver el anterior"
        >
          <i className="icon-keyboard_arrow_left" aria-hidden="true" />
        </button>

        <ul
          className="poster-strip__track"
          ref={(node) => { this.strip = node; }}
          onScroll={this.handleScroll}
        >
          {posters.map((poster, index) => (
            <li className="poster-strip__item" key={poster.id}>
              <Poster
                filename={poster.filename}
                url={poster.url}
                priority={index === 0}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="poster-strip__arrow poster-strip__arrow--next"
          onClick={() => this.scrollBy(1)}
          aria-label="Ver el siguiente"
        >
          <i className="icon-keyboard_arrow_right" aria-hidden="true" />
        </button>

        <div className="poster-strip__dots">
          {canAutoplay && (
            <button
              type="button"
              className="poster-strip__toggle"
              onClick={this.toggleUserPause}
              aria-label={userPaused ? 'Reanudar los afiches' : 'Pausar los afiches'}
              data-running={running ? 'true' : 'false'}
              style={{ '--poster-strip-countdown': `${AUTOPLAY_INTERVAL_MS}ms` }}
            >
              <svg className="poster-strip__ring" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle className="poster-strip__ring-track" cx="12" cy="12" r="10" pathLength="100" />
                <circle
                  key={cycle}
                  className="poster-strip__ring-progress"
                  cx="12"
                  cy="12"
                  r="10"
                  pathLength="100"
                />
              </svg>
              {userPaused && (
                <svg className="poster-strip__play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          )}

          {posters.map((poster, index) => (
            <button
              key={poster.id}
              type="button"
              className="poster-strip__dot"
              aria-current={index === currentIndex ? 'true' : undefined}
              aria-label={`Ver el afiche ${index + 1} de ${posters.length}`}
              onClick={() => this.scrollToIndex(index)}
            />
          ))}
        </div>
      </div>
    );
  }
}

PosterStrip.propTypes = {
  posters: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    filename: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  })).isRequired,
};

export default PosterStrip;
