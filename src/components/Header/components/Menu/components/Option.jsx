import PropTypes from 'prop-types';

export default function Option(props) {
  const { name } = props;
  return (
    <li className="options__li">
      <p>{name}</p>
    </li>
  );
}

Option.propTypes = {
  name: PropTypes.string.isRequired,
};
