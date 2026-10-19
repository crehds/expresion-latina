/**
 * Sets a new password for the signed-in member (Design: D5, D10).
 *
 * It serves both the page a recovery link opens (the link has just signed the
 * member in) and the account page. The password is typed twice and checked first
 * (`validateNewPassword`: the very rule of the sign-up, and the two must match),
 * with a message per field and the focus on the first one that is wrong. The
 * password is sent exactly as typed. A failed call shows the fixed message of its
 * result code in an alert, never what the backend said or the password. After
 * a success the member's other devices are signed out (a failure of that step is
 * ignored: the password changed). The parent decides what follows (`onDone`).
 */
import PropTypes from 'prop-types';
import { useContext, useRef, useState } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { validateNewPassword } from '../domain/signupValidation';
import AuthField from './AuthField';
import { NEW_PASSWORD_MESSAGES, PASSWORD_HINT, authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

export default function NewPassword({ onDone }) {
  const { services } = useContext(BackendContext);
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState({});
  const passwordRef = useRef(null);
  const confirmationRef = useRef(null);

  const auth = services?.auth;
  if (!auth) {
    return null;
  }

  const messageFor = (field) => (
    errors[field] ? NEW_PASSWORD_MESSAGES[field][errors[field]] : undefined
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const checks = validateNewPassword({ password, confirmation });
    setErrors(checks.errors);
    if (!checks.valid) {
      clear();
      (checks.errors.password ? passwordRef : confirmationRef).current?.focus();
      return;
    }

    const outcome = await run(() => auth.updatePassword({ password }));
    if (outcome.ok) {
      // The password did change, so this step can only end in success: whether
      // the other devices were signed out does not turn it into an error.
      try {
        await auth.signOutOthers();
      } catch {
        // Ignored on purpose.
      }
      onDone();
    }
  };

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      {errorCode && (
        <p className="auth-form__alert" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      <AuthField
        label="Nueva contraseña"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint={PASSWORD_HINT}
        error={messageFor('password')}
        inputRef={passwordRef}
      />
      <AuthField
        label="Repite la contraseña"
        name="password-confirmation"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={setConfirmation}
        error={messageFor('confirmation')}
        inputRef={confirmationRef}
      />
      <button type="submit" className="auth-button auth-button--primary" disabled={busy}>
        Cambiar contraseña
      </button>
    </form>
  );
}

NewPassword.propTypes = {
  onDone: PropTypes.func.isRequired,
};
