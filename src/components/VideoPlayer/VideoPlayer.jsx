import PropTypes from 'prop-types';

import './css/video-player.css';

/**
 * A 16:9 video in a fluid container.
 *
 * This started life inside the genre pages. It moved here when a teacher's
 * profile needed the same thing: a player is not specific to what is being
 * danced in it.
 */
function VideoPlayer({ src, title = '' }) {
  return (
    <div className="video-player">
      <video
        src={src}
        title={title}
        controls
        preload="metadata"
        className="video-player__video"
      >
        <track default kind="captions" srcLang="es" />
      </video>
    </div>
  );
}

VideoPlayer.propTypes = {
  src: PropTypes.string.isRequired,
  title: PropTypes.string,
};

export default VideoPlayer;
