import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { Page, VideoPlayer } from '../../../components';
import { getGenreBySlug, getTeachersByGenreId, getVideosByGenreId } from '../../../data';
import withRouter from '../../../hocs/withRouter';

import '../css/dance-videos.css';

/**
 * One dance style: what it looks like, and who teaches it.
 *
 * The videos are the preview — the academy's own footage of the class — and
 * the teachers under them link straight to their profile, so choosing a style
 * and choosing a teacher are the same journey rather than two.
 */
function DanceVideos(props) {
  const { params, navigate } = props;
  const { genreSlug } = params;

  const genre = getGenreBySlug(genreSlug);
  const videos = genre ? getVideosByGenreId(genre.id) : [];
  const teachers = genre ? getTeachersByGenreId(genre.id) : [];

  const back = (
    <button
      className="dance-videos__back"
      type="button"
      aria-label="Volver"
      onClick={() => navigate(-1)}
    >
      <i className="icon-arrow-left" aria-hidden="true" />
    </button>
  );

  return (
    <Page
      title={genre ? genre.name : 'Género no encontrado'}
      lead={genre?.description}
      action={back}
      className="dance-videos"
    >
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

      {teachers.length > 0 && (
        <section className="dance-videos__teachers">
          <h3 className="heading-xs dance-videos__subheading">Quién la dicta</h3>
          <ul className="dance-videos__teacher-list">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <Link className="dance-videos__teacher" to={`/teachers/${teacher.id}`}>
                  {teacher.image ? (
                    <img
                      className="dance-videos__teacher-image"
                      src={teacher.image}
                      alt=""
                    />
                  ) : (
                    <span className="dance-videos__teacher-initials" aria-hidden="true">
                      {teacher.initials}
                    </span>
                  )}
                  <span className="text-sm dance-videos__teacher-name">{teacher.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

DanceVideos.propTypes = {
  params: PropTypes.instanceOf(Object).isRequired,
  navigate: PropTypes.func.isRequired,
};

export default withRouter(DanceVideos);
