import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../css/option.css';

export default function Option(props) {
  const { name, handleOption, path } = props;

  return (
    <li className="option">
      <Link to={path} onClick={handleOption} className="option__link">
        {name}
      </Link>
    </li>
  );
}

Option.propTypes = {
  name: PropTypes.string.isRequired,
  handleOption: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,
};
