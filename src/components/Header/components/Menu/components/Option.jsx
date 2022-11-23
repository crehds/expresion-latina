import PropTypes from 'prop-types';
import '../css/option.css';

export default function Option(props) {
  const { name } = props;
  return (
    <li className="option">
      <p>{name}</p>
    </li>
  );
}

Option.propTypes = {
  name: PropTypes.string.isRequired,
};
