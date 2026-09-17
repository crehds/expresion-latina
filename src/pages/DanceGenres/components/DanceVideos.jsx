import PropTypes from 'prop-types';

import { VideoPlayer } from '../../../components';
import { getGenreBySlug, getVideosByGenreId } from '../../../data';
import withRouter from '../../../hocs/withRouter';

import '../css/dance-videos.css';

function DanceVideos(props) {
  const { params, navigate } = props;
  const { genreSlug } = params;

  const genre = getGenreBySlug(genreSlug);
  const videos = genre ? getVideosByGenreId(genre.id) : [];

  return (
    <div className="dance-videos">
      <div className="dance-videos__title">
        <button
          className="dance-videos__back"
          type="button"
          aria-label="Volver"
          onClick={() => navigate(-1)}
        >
          <i className="icon-arrow-left" />
        </button>
        <h2 className="heading-sm dance-videos__heading">
          {genre ? genre.name : 'Género no encontrado'}
        </h2>
      </div>
      <div className="dance-videos__container">
        {videos.map((video) => (
          <VideoPlayer key={video.id} src={video.src} title={video.title} />
        ))}
        {genre && videos.length === 0 && (
          <p className="text-sm dance-videos__empty">
            Todavía no hay videos de
            {' '}
            {genre.name}
            .
          </p>
        )}
      </div>
    </div>
  );
}

DanceVideos.propTypes = {
  params: PropTypes.instanceOf(Object).isRequired,
  navigate: PropTypes.func.isRequired,
};

export default withRouter(DanceVideos);
