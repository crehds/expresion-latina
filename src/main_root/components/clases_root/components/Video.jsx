import PropTypes from 'prop-types';
import '../css/video.css';

export default function Video(props) {
  const { src } = props;
  return (
    <div className="video-box">
      <div className="prueba4">
        <video
          width="720px"
          height="480"
          src={process.env.PUBLIC_URL + src}
          controls
        >
          <track default kind="captions" srcLang="es" />
        </video>
      </div>

      <div className="icon-video-container">
        <i className="icon3-credit-card icon-video" />
        <i className="icon3-eye1 icon-video" />
        <i className="icon3-info icon-video" />
      </div>
    </div>
  );
}

Video.propTypes = {
  src: PropTypes.string.isRequired,
};
