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

  scrollBy = (direction) => {
    if (!this.strip) return;

    // One card at a time, whatever a card currently measures.
    const card = this.strip.querySelector('.poster');
    const step = card ? card.getBoundingClientRect().width : this.strip.clientWidth;

    this.strip.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  // A slide is the full width of the track now, so the track's own width is
  // the step between one poster and the next.
  scrollToIndex = (index) => {
    if (!this.strip) return;

    this.strip.scrollTo({ left: this.strip.clientWidth * index, behavior: 'smooth' });
  };

  // The dots have no state of their own: reading the track's scroll position
  // back is what keeps them correct after a swipe, not only after a click.
  handleScroll = () => {
    if (!this.strip) return;

    const { scrollLeft, clientWidth } = this.strip;
    if (!clientWidth) return;

    this.setState({ currentIndex: Math.round(scrollLeft / clientWidth) });
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
