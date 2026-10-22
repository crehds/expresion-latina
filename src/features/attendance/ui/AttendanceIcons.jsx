import PropTypes from 'prop-types';

import './css/attendance-icons.css';

/*
 * The two icons of the attendance controls, drawn inline: the icon font has no
 * check and no X of this weight, and the CSP allows no style attribute, so only the
 * geometry is here and the stylesheet gives them their size, their stroke and their
 * colour (it is the colour of the text around them). They are decorative. The
 * button that holds one has its own name, and the legend names them where it draws
 * them.
 */
function Icon({ kind, path, className = '' }) {
  return (
    <svg
      className={`attendance-icon attendance-icon--${kind}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

Icon.propTypes = {
  kind: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  className: PropTypes.string,
};

/** The check: what a tap does on a class that is not confirmed yet. */
export function CheckIcon({ className = '' }) {
  return <Icon kind="check" path="M5 12.5 9.5 17 19 7.5" className={className} />;
}

/** The X: what a tap does on a class that is confirmed. */
export function CrossIcon({ className = '' }) {
  return <Icon kind="cross" path="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" className={className} />;
}

CheckIcon.propTypes = { className: PropTypes.string };
CrossIcon.propTypes = { className: PropTypes.string };
