import PropTypes from 'prop-types';
import withRouter from '../../../hocs/withRouter';
import VIDEOS from '../api/danceVideos';

import '../css/dance-videos.css';
import DanceVideo from './DanceVideo';

function DanceVideos(props) {
  const { params } = props;
  const { danceGenreId } = params;
  return (
    <div className="dance-videos">
      <h2>{danceGenreId}</h2>
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
};

export default withRouter(DanceVideos);
