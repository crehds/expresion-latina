import PropTypes from 'prop-types';

import '../css/dance-video.css';

function DanceVideo(props) {
  const { src } = props;
  return (
    <div className="dance-video">
      <div className="dance-video__container">
        <video src={src} controls className="dance-video__video">
          <track default kind="captions" srcLang="es,en" />
        </video>

      </div>
    </div>
  );
}
DanceVideo.propTypes = {
  src: PropTypes.string.isRequired,
};

export default DanceVideo;
