/**
 * The consent checkbox of the sign-in page (Design: D5).
 *
 * It is the last field of the sign-up form, right before its button, and the
 * sign-up does not start until it is checked. Google does not wait for it: that
 * button states its own acceptance of the notice. The words
 * "Aviso de privacidad" link to the notice in a new tab, so a member who stops
 * to read it does not lose what they typed.
 */
import PropTypes from 'prop-types';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import './css/auth-forms.css';

export default function ConsentCheckbox({ checked, onChange }) {
  const id = useId();

  return (
    <label className="auth-consent" htmlFor={id}>
      <input
        id={id}
        className="auth-consent__box"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Leí y acepto el
        {' '}
        <Link className="auth-consent__link" to="/privacy" target="_blank" rel="noopener noreferrer">
          Aviso de privacidad
        </Link>
      </span>
    </label>
  );
}

ConsentCheckbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};
