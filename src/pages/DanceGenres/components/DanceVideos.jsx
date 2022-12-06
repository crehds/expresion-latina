import PropTypes from 'prop-types';
import withRouter from '../../../hocs/withRouter';
import VIDEOS from '../api/danceVideos';

import '../css/dance-videos.css';
import DanceVideo from './DanceVideo';

function DanceVideos(props) {
  const { params, navigate } = props;
  const { danceGenreId } = params;
  return (
    <div className="dance-videos">
      <div className="dance-videos__title">
        <button
          className="dance-videos__back"
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <i className="icon-arrow-left" />
        </button>
        <h2 className="heading-sm dance-videos__heading">{danceGenreId}</h2>
      </div>
      <div className="dance-videos__container">
        {VIDEOS.map((video) => (
          <DanceVideo key={`video-${video.id}`} src={video.src} />
        ))}
      </div>
    </div>

  );
}

DanceVideos.propTypes = {
  params: PropTypes.instanceOf(Object).isRequired,
  navigate: PropTypes.func.isRequired,
};

export default withRouter(DanceVideos);
