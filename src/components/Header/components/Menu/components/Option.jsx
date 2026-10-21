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

/**
 * One entry of the menu.
 *
 * It is lit while the page being shown is the one it links to or lies under it.
 * An entry that links to the first of several pages (Admin goes to the members)
 * can name the area it stands for with `activePath`, and is then lit on every
 * page of that area.
 */
export default function Option({
  name, location, onNavigate, path, activePath = undefined,
}) {
  const active = covers(location.pathname, activePath ?? path);
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
  activePath: PropTypes.string,
  location: PropTypes.instanceOf(Object).isRequired,
};
