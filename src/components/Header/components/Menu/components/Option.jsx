import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../css/option.css';

export default function Option(props) {
  const {
    name, location, onNavigate, path,
  } = props;

  const active = location.pathname === path;
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
