import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../css/option.css';

/**
 * Whether a menu entry covers the page being shown.
 *
 * The entries are flat — /teachers, /dances — while App routes them as
 * /teachers/:teacherId and /dances/*, so the pathname a visitor reaches by
 * clicking through is longer than the entry that should be lit. Comparing the
 * two for equality left the menu blank on every one of those pages, and took
 * aria-current with it.
 *
 * The boundary is the slash: a prefix is not an ancestor, or /teachers would
 * light on /teachers-invitados.
 *
 * Inicio needs no case of its own. Its path is "/", so the prefix tested here
 * is "//", and no pathname begins with that — it matches the root exactly and
 * nothing else, which is what it should do.
 */
function covers(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Option(props) {
  const {
    name, location, onNavigate, path,
  } = props;

  const active = covers(location.pathname, path);
  return (
    <li className="text-md option">
      <Link
        onClick={onNavigate}
        to={path}
        className={`option__link${active ? ' option__link--active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {name}
      </Link>
    </li>
  );
}

Option.propTypes = {
  name: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,
  location: PropTypes.instanceOf(Object).isRequired,
};
