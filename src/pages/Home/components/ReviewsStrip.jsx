import { Component } from 'react';

import { reviews } from '../../../data';

import '../css/reviews-strip.css';

/**
 * What students have said about the academy.
 *
 * A strip on the landing page rather than a page of its own: an opinion is
 * something you meet while reading about the place, not somewhere you navigate
 * to. It scrolls and snaps like the posters, so one gesture works for both.
 *
 * Nothing renders until there are opinions to show. The academy adds them from
 * the spreadsheet; they are expected to come from Instagram comments, so each
 * one can carry where it was left and a link back to it.
 */
class ReviewsStrip extends Component {
  scrollBy = (direction) => {
    if (!this.strip) return;

    const card = this.strip.querySelector('.review');
    const step = card ? card.getBoundingClientRect().width : this.strip.clientWidth;

    this.strip.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  render() {
    if (reviews.length === 0) return null;

    return (
      <section className="reviews-strip" aria-labelledby="reviews-heading">
        <div className="reviews-strip__header">
          <h2 className="heading-sm reviews-strip__heading" id="reviews-heading">
            Lo que dicen
          </h2>

          {reviews.length > 1 && (
            <div className="reviews-strip__controls">
              <button
                type="button"
                className="reviews-strip__arrow"
                onClick={() => this.scrollBy(-1)}
                aria-label="Ver la anterior"
              >
                <i className="icon-keyboard_arrow_left" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="reviews-strip__arrow"
                onClick={() => this.scrollBy(1)}
                aria-label="Ver la siguiente"
              >
                <i className="icon-keyboard_arrow_right" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <ul
          className="reviews-strip__track"
          ref={(node) => { this.strip = node; }}
        >
          {reviews.map((review) => (
            <li className="review" key={review.id}>
              <blockquote className="review__quote">
                <p className="text-md review__text">{review.text}</p>
                <footer className="review__author">
                  <cite className="text-sm review__name">{review.author}</cite>
                  {review.sourceUrl ? (
                    <a
                      className="text-sm review__source"
                      href={review.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {review.source ?? 'Ver'}
                    </a>
                  ) : (
                    review.source && (
                      <span className="text-sm review__source">{review.source}</span>
                    )
                  )}
                </footer>
              </blockquote>
            </li>
          ))}
        </ul>
      </section>
    );
  }
}

export default ReviewsStrip;
