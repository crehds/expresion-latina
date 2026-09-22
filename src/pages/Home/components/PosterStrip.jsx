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
    };
  }

  componentDidMount() {
    this.reducedMotionQuery.addEventListener('change', this.handleReducedMotionChange);
    this.startAutoplay();
  }

  componentWillUnmount() {
    this.reducedMotionQuery.removeEventListener('change', this.handleReducedMotionChange);
    this.stopAutoplay();
  }

  // A visitor can flip this preference mid-visit, not only before the page
  // loads, so autoplay has to react to it rather than check it once at mount.
  handleReducedMotionChange = (event) => {
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
    if (this.autoplayTimer || this.holds.size || this.reducedMotionQuery.matches) return;

    this.autoplayTimer = setInterval(this.advance, AUTOPLAY_INTERVAL_MS);
  };

  hold = (reason) => {
    this.holds.add(reason);
    this.stopAutoplay();
  };

  // The hold a touch screen would never lift again, so it is never taken.
  holdPointer = () => {
    if (this.hoverQuery.matches) this.hold('pointer');
  };

  release = (reason) => {
    this.holds.delete(reason);
    this.startAutoplay();
  };

  stopAutoplay = () => {
    clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
  };

  // Reuses scrollToIndex rather than a second distance calculation, and
  // wraps past the last poster back to the first instead of stopping there.
  advance = () => {
    const { posters } = this.props;
    const { currentIndex } = this.state;

    this.scrollToIndex((currentIndex + 1) % posters.length);
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
    const { currentIndex } = this.state;

    return (
      <div
        className="poster-strip"
        onMouseEnter={this.holdPointer}
        onMouseLeave={() => this.release('pointer')}
        onFocus={() => this.hold('focus')}
        onBlur={() => this.release('focus')}
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
