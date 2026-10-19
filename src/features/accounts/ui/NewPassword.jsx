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
 * ignored: the password changed, and the wait is bounded so a hung call cannot
 * hide the success). The form stays busy until the parent is told (`onDone`),
 * which decides what follows.
 */
import PropTypes from 'prop-types';
import { useContext, useRef, useState } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { validateNewPassword } from '../domain/signupValidation';
import AuthField from './AuthField';
import { NEW_PASSWORD_MESSAGES, PASSWORD_HINT, authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

// How long the success waits for the other devices to be signed out.
const SIGN_OUT_OTHERS_WAIT_MS = 5000;

// Resolves when the call ends, however it ends, or when the wait runs out.
function settleWithin(action, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    // Calling inside the executor turns a synchronous throw into a rejection.
    new Promise((run) => { run(action()); }).then(done, done);
  });
}

export default function NewPassword({ onDone }) {
  const { services } = useContext(BackendContext);
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState({});
  const [finishing, setFinishing] = useState(false);
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

    // The form stays busy from the submit until the parent is told.
    setFinishing(true);
    const outcome = await run(() => auth.updatePassword({ password }));
    if (outcome.ok) {
      // The password did change, so this step can only end in success: whether
      // the other devices were signed out (or how long that took) does not turn
      // it into an error.
      await settleWithin(() => auth.signOutOthers(), SIGN_OUT_OTHERS_WAIT_MS);
      onDone();
    }
    setFinishing(false);
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
      <button type="submit" className="auth-button auth-button--primary" disabled={busy || finishing}>
        Cambiar contraseña
      </button>
    </form>
  );
}

NewPassword.propTypes = {
  onDone: PropTypes.func.isRequired,
};
