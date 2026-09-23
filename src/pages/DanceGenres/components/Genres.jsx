import PropTypes from 'prop-types';

import { Page } from '../../../components';
import { getActiveTeachersByGenreId, groupGenresBySchedule } from '../../../data/selectors';

import '../css/genres.css';
import Genre from './Genre';

const genreShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
});

function GenreList({ genres }) {
  return (
    <ul className="dance-genres">
      {genres.map((genre) => (
        <Genre
          key={genre.id}
          name={genre.name}
          slug={genre.slug}
          teachers={getActiveTeachersByGenreId(genre.id)}
        />
      ))}
    </ul>
  );
}

GenreList.propTypes = { genres: PropTypes.arrayOf(genreShape).isRequired };

/**
 * The styles the academy teaches, the ones running now first.
 *
 * A genre with no hour on the schedule is ordinary: the academy lists a style
 * before it can staff it. So nothing is hidden and nothing is invented — the
 * page only says which of the two a box is, because a visitor scanning it is
 * looking for something they can attend this week.
 *
 * The headings appear only when there is something on both sides of the line.
 * One group alone needs no label to tell it apart from the other.
 */
function Genres(props) {
  const { danceGenres } = props;
  const { scheduled, upcoming } = groupGenresBySchedule(danceGenres);
  const split = scheduled.length > 0 && upcoming.length > 0;

  return (
    <Page title="Clases" lead="Los estilos que se dictan en la academia.">
      {scheduled.length > 0 && (
        <section className="dance-genres__group">
          {split && <h2 className="text-lg dance-genres__heading">En horario</h2>}
          <GenreList genres={scheduled} />
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="dance-genres__group">
          {split && <h2 className="text-lg dance-genres__heading">Próximamente</h2>}
          <p className="text-sm dance-genres__note">
            Todavía no tienen horario publicado. Escríbenos y te avisamos cuando abran.
          </p>
          <GenreList genres={upcoming} />
        </section>
      )}
    </Page>
  );
}

Genres.propTypes = {
  danceGenres: PropTypes.arrayOf(genreShape).isRequired,
};

export default Genres;
