import PropTypes from 'prop-types';

import VideoPlayer from '../VideoPlayer/VideoPlayer';

import './css/video-card.css';

/*
 * A video with a name under it.
 *
 * The genre pages used to drop a bare <video> onto the page. A player with no
 * chrome and nothing beside it reads as an unstyled black slab before it has
 * loaded a frame, and once there is more than one of them nothing says which
 * class each belongs to.
 *
 * The card is the part that does not depend on having the footage: the frame,
 * the title and the caption are the same whether the src points at a file in
 * this repository or at something the academy uploads next month.
 */
export default function VideoCard({ src, title, caption = undefined }) {
  return (
    <article className="video-card">
      <div className="video-card__media">
        <VideoPlayer src={src} title={title} />
      </div>
      <div className="video-card__body">
        <h3 className="text-md video-card__title">{title}</h3>
        {caption && <p className="text-sm video-card__caption">{caption}</p>}
      </div>
    </article>
  );
}

VideoCard.propTypes = {
  src: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  /** One line under the title. Omitted rather than filled with the obvious. */
  caption: PropTypes.string,
};
