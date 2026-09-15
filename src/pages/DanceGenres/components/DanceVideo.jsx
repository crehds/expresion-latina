import PropTypes from 'prop-types';

import '../css/dance-video.css';

function DanceVideo(props) {
  const { src, title } = props;
  return (
    <div className="dance-video">
      <div className="dance-video__container">
        <video
          src={src}
          title={title}
          controls
          preload="metadata"
          className="dance-video__video"
        >
          <track default kind="captions" srcLang="es" />
        </video>
      </div>
    </div>
  );
}

DanceVideo.propTypes = {
  src: PropTypes.string.isRequired,
  title: PropTypes.string,
};

DanceVideo.defaultProps = {
  title: '',
};

export default DanceVideo;
