import PropTypes from 'prop-types';

import '../css/hamburger.css';

/**
 * Opens the drawer on a tablet or a phone. It is not rendered at all on a
 * desktop, where the links are already in the bar.
 *
 * A button rather than an <i> with a role: it was a non-focusable element
 * carrying role="button", which meant the keyboard could reach it only because
 * of a hand-added tabIndex and it never announced its state.
 */
function Hamburger({ isOpen, onToggle }) {
  return (
    <button
      type="button"
      className="hamburger"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls="main-menu"
      aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
    >
      <i className={isOpen ? 'icon-x' : 'icon-menu'} aria-hidden="true" />
    </button>
  );
}

Hamburger.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default Hamburger;
