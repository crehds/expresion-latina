/**
 * Sends the confirmation email of a sign-up again (Design: D5, D10).
 *
 * It is shown where a member is stuck on an unconfirmed address: after a
 * sign-in that answered "confirm your email first", and on the confirmation
 * page when the link expired. The address starts as the one the member already
 * typed. As with the password reset, the answer is the same fixed message
 * whether or not the address has a pending sign-up, and it takes the place of
 * the button. A failed call shows the fixed message of its result code in an
 * alert, never what the backend said.
 */
import PropTypes from 'prop-types';
import {
  useContext, useEffect, useRef, useState,
} from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { validateResetRequest } from '../domain/signupValidation';
import AuthField from './AuthField';
import { RESEND_SENT, RESET_REQUEST_MESSAGES, authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

export default function ResendConfirmation({ initialEmail = '' }) {
  const { services } = useContext(BackendContext);
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const emailRef = useRef(null);
  const sentRef = useRef(null);

  useEffect(() => {
    if (sent) {
      sentRef.current?.focus();
    }
  }, [sent]);

  const auth = services?.auth;
  if (!auth) {
    return null;
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

    // No redirect target: the confirmation email template decides the link.
    const outcome = await run(() => auth.resendConfirmation({ email }));
    if (outcome.ok) {
      setSent(true);
    }
  };

  return (
    <form className="auth-form" noValidate aria-label="Reenviar confirmación" onSubmit={handleSubmit}>
      {errorCode && (
        <p className="auth-form__alert" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      {sent ? (
        <p className="auth-form__done" role="status" tabIndex={-1} ref={sentRef}>
          {RESEND_SENT}
        </p>
      ) : (
        <>
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
          <button type="submit" className="auth-button" disabled={busy}>
            Reenviar correo de confirmación
          </button>
        </>
      )}
    </form>
  );
}

ResendConfirmation.propTypes = {
  initialEmail: PropTypes.string,
};
