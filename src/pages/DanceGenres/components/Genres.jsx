import PropTypes from 'prop-types';

import '../css/genres.css';
import Genre from './Genre';

function Genres(props) {
  const { danceGenres } = props;
  return (
    <div className="dance-genres">
      {danceGenres.map((genre) => (
        <Genre key={genre.id} name={genre.name} slug={genre.slug} />
      ))}
    </div>
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
