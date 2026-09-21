import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { Page, VideoCard } from '../../../components';
import { getGenreBySlug, getVideosByGenreId } from '../../../data';
import { getActiveTeachersByGenreId } from '../../../data/selectors';
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
  const teachers = genre ? getActiveTeachersByGenreId(genre.id) : [];

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
      {videos.length > 0 && (
        <ul className="dance-videos__container">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoCard src={video.src} title={video.title} />
            </li>
          ))}
        </ul>
      )}

      {genre && videos.length === 0 && (
        /*
         * Most genres reach this, so it is a state the page is in rather than
         * an error it is reporting. It says what is missing and offers the
         * thing the visitor came for anyway: when the class runs.
         */
        <div className="dance-videos__empty">
          <p className="text-md dance-videos__empty-title">
            Todavía no hay videos de
            {' '}
            {genre.name}
            .
          </p>
          <Link className="dance-videos__empty-link" to="/schedules">
            Ver cuándo se dicta
          </Link>
        </div>
      )}

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
