import PropTypes from 'prop-types';
import '../css/hamburger.css';

export default function Hamburger(props) {
  const { handleMenu } = props;
  return (
    <i
      id="hamburger"
      className="icon-menu hamburger"
      onClick={handleMenu}
      onKeyDown={handleMenu}
      role="button"
      tabIndex={0}
      aria-label="hamburger-icon"
    />
  );
}

Hamburger.propTypes = {
  handleMenu: PropTypes.func.isRequired,
};
