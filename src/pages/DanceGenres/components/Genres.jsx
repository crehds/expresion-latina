import PropTypes from 'prop-types';

import { Page } from '../../../components';
import { getActiveTeachersByGenreId } from '../../../data/selectors';

import '../css/genres.css';
import Genre from './Genre';

function Genres(props) {
  const { danceGenres } = props;
  return (
    <Page title="Clases" lead="Los estilos que se dictan en la academia.">
      <ul className="dance-genres">
        {danceGenres.map((genre) => (
          <Genre
            key={genre.id}
            name={genre.name}
            slug={genre.slug}
            teachers={getActiveTeachersByGenreId(genre.id)}
          />
        ))}
      </ul>
    </Page>
  );
}

Genres.propTypes = {
  danceGenres: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
  })).isRequired,
};

export default Genres;
