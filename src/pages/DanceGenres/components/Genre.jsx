import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import '../css/genre.css';

function Genre(props) {
  const { name } = props;
  return (
    <Link
      to={`/dances/${name}/videos`}
      className="dance-genre"
    >
      <p>{name}</p>
    </Link>
  );
}

Genre.propTypes = {
  name: PropTypes.string.isRequired,
};

export default Genre;
