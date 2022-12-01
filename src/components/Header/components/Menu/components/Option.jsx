import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../css/option.css';

export default function Option(props) {
  const {
    name, location, path,
  } = props;

  const active = location.pathname === path;
  return (
    <li className="option">
      <Link to={path} className={`option__link ${active && 'option__link--active'}`}>
        {name}
      </Link>
    </li>
  );
}

Option.propTypes = {
  name: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  location: PropTypes.instanceOf(Object).isRequired,
};
