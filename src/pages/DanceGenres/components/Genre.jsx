import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import '../css/genre.css';

function Genre(props) {
  const { name, slug } = props;
  return (
    <div className="dance-genre">
      <Link
        to={`/dances/${slug}/videos`}
        className="dance-genre__link"
      >
        <p className="text-lg dance-genre__name">{name}</p>
      </Link>
    </div>
  );
}

Genre.propTypes = {
  name: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
};

export default Genre;
