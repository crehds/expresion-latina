/**
 * One labelled input of the sign-in and sign-up forms.
 *
 * The label wraps the input and names it. A hint (always visible) and an error
 * (only after a failed check) are linked to the input with `aria-describedby`,
 * so a screen reader reads them with the field, and `aria-invalid` is set only
 * while there is an error. The field is announced as required with
 * `aria-required`, not the `required` attribute: the form checks the fields
 * itself, and a native constraint would also mark an untouched empty field as
 * invalid to the browser. The form decides what the error says and which field
 * to focus, through `inputRef`.
 */
import PropTypes from 'prop-types';
import { useId } from 'react';
import './css/auth-forms.css';

export default function AuthField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  autoComplete = undefined,
  maxLength = undefined,
  hint = undefined,
  error = undefined,
  inputRef = undefined,
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
        <input
          id={id}
          ref={inputRef}
          className="auth-field__input"
          name={name}
          type={type}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-required="true"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
      </label>
      {hint && <p id={hintId} className="auth-field__hint">{hint}</p>}
      {error && <p id={errorId} className="auth-field__error">{error}</p>}
    </div>
  );
}

AuthField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  type: PropTypes.string,
  autoComplete: PropTypes.string,
  maxLength: PropTypes.number,
  hint: PropTypes.string,
  error: PropTypes.string,
  inputRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
};
