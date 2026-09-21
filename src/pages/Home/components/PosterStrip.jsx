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
  scrollBy = (direction) => {
    if (!this.strip) return;

    // One card at a time, whatever a card currently measures.
    const card = this.strip.querySelector('.poster');
    const step = card ? card.getBoundingClientRect().width : this.strip.clientWidth;

    this.strip.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  render() {
    const { posters } = this.props;

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
