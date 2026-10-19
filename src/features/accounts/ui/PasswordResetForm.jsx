/**
 * Asks for the email that lets a member choose a new password (Design: D5, D10).
 *
 * The address is checked first (`validateResetRequest`) and only then sent. The
 * answer is the same fixed message whether or not the address has an account,
 * and it takes the place of the form, so the page cannot be used to find out who
 * is a member. A failed call shows the fixed message of its result code in an
 * alert, never what the backend said.
 *
 * No redirect target is sent: the link in the email is built by the email
 * template from the site URL and the token hash, and ignores any target.
 */
import {
  useContext, useEffect, useRef, useState,
} from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { validateResetRequest } from '../domain/signupValidation';
import AuthField from './AuthField';
import { RESET_REQUEST_MESSAGES, RESET_REQUEST_SENT, authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

export default function PasswordResetForm() {
  const { services } = useContext(BackendContext);
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const emailRef = useRef(null);
  const sentRef = useRef(null);

  // The message replaces the form, so the focus goes to it for a screen reader.
  useEffect(() => {
    if (sent) {
      sentRef.current?.focus();
    }
  }, [sent]);

  const auth = services?.auth;
  if (!auth) {
    return null;
  }

  if (sent) {
    return (
      <p className="auth-form__done" role="status" tabIndex={-1} ref={sentRef}>
        {RESET_REQUEST_SENT}
      </p>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const checks = validateResetRequest({ email });
    setErrors(checks.errors);
    if (!checks.valid) {
      clear();
      emailRef.current?.focus();
      return;
    }

    const outcome = await run(() => auth.requestPasswordReset({ email }));
    if (outcome.ok) {
      setSent(true);
    }
  };

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      {errorCode && (
        <p className="auth-form__alert" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      <AuthField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={errors.email ? RESET_REQUEST_MESSAGES.email[errors.email] : undefined}
        inputRef={emailRef}
      />
      <button type="submit" className="auth-button auth-button--primary" disabled={busy}>
        Enviar enlace
      </button>
    </form>
  );
}
