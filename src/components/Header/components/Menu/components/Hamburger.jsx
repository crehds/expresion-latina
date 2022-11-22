import PropTypes from 'prop-types';
import '../css/hamburger.css';

export default function Hamburger(props) {
  const { handleIsMenuActive } = props;
  return (
    <i
      id="hamburger"
      className="icon-menu hamburger-menu"
      onClick={handleIsMenuActive}
      onKeyDown={handleIsMenuActive}
      role="button"
      tabIndex={0}
      aria-label="hamburger-icon"
    />
  );
}

Hamburger.propTypes = {
  handleIsMenuActive: PropTypes.func.isRequired,
};
