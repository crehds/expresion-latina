import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import '../css/genre.css';

/**
 * One dance style, as a box into its page.
 *
 * It carries who teaches it as well as its name: fifteen boxes holding only a
 * name are fifteen identical boxes, and nothing in them helps a visitor choose
 * which to open.
 */
function Genre({ name, slug, teachers }) {
  const names = teachers.map((teacher) => teacher.shortName ?? teacher.name);
  const shown = names.slice(0, 2).join(', ');
  const rest = names.length - 2;

  return (
    <li className="dance-genre">
      <Link to={`/dances/${slug}/videos`} className="dance-genre__link">
        <p className="text-lg dance-genre__name">{name}</p>
        {names.length > 0 && (
          <p className="text-sm dance-genre__meta">
            {rest > 0 ? `${shown} +${rest}` : shown}
          </p>
        )}
      </Link>
    </li>
  );
}

Genre.propTypes = {
  name: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  teachers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string,
  })).isRequired,
};

export default Genre;
