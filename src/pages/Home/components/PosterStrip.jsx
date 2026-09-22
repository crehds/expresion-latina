import { Component } from 'react';
import PropTypes from 'prop-types';

import Poster from './Poster';

import '../css/poster-strip.css';

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

    this.state = {
      currentIndex: 0,
    };
  }

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
      <div className="poster-strip">
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
