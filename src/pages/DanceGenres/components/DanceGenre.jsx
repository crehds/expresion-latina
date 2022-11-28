import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import '../css/dance-genre.css';

function DanceGenre(props) {
  const { name } = props;
  return (
    <Link
      to="/name"
      className="dance-genre"
    >
      <p>{name}</p>
    </Link>
  );
}

DanceGenre.propTypes = {
  name: PropTypes.string.isRequired,
};

export default DanceGenre;
