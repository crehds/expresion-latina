/**
 * Sign up with a name, an email and a password (Design: D5.2).
 *
 * The consent travels with the request: the `auth.users` trigger refuses an
 * email account without the accepted notice version and a name. So the button
 * waits for the consent checkbox of the page (`consentAccepted`), and a submit
 * that gets around the disabled button is refused here as well. The fields are
 * checked first (`validateSignUp`), a message per field with the focus on the
 * first one that is wrong, and the name that is sent is the trimmed one the
 * check judged.
 *
 * With confirmations on, the account cannot sign in until the address is
 * confirmed, so success only asks the member to check their email. The message
 * is the same whether or not the address already had an account (the adapter
 * does not tell them apart). A failed call shows the fixed message of its
 * result code in an alert, never what the backend said.
 */
import PropTypes from 'prop-types';
import {
  useContext, useEffect, useRef, useState,
} from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { authCallbackUrl } from '../domain/authRedirect';
import { CURRENT_NOTICE_VERSION } from '../domain/noticeVersion';
import { FULL_NAME_MAX_LENGTH, validateSignUp } from '../domain/signupValidation';
import AuthField from './AuthField';
import {
  CONFIRMATION_SENT, PASSWORD_HINT, SIGN_UP_MESSAGES, authErrorMessage,
} from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

export default function SignUpForm({ consentAccepted }) {
  const { services } = useContext(BackendContext);
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const fullNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
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
        {CONFIRMATION_SENT}
      </p>
    );
  }

  const messageFor = (field) => (
    errors[field] ? SIGN_UP_MESSAGES[field][errors[field]] : undefined
  );
  const alertMessage = (errors.consent && messageFor('consent'))
    || (errorCode && authErrorMessage(errorCode));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const checks = validateSignUp({
      fullName, email, password, consentAccepted,
    });
    setErrors(checks.errors);
    if (!checks.valid) {
      clear();
      const firstWrong = [
        [checks.errors.fullName, fullNameRef],
        [checks.errors.email, emailRef],
        [checks.errors.password, passwordRef],
      ].find(([problem]) => problem);
      firstWrong?.[1].current?.focus();
      return;
    }

    const outcome = await run(() => auth.signUp({
      email,
      password,
      fullName: fullName.trim(),
      consentVersion: CURRENT_NOTICE_VERSION,
      redirectTo: authCallbackUrl(),
    }));
    if (outcome.ok) {
      setSent(true);
    }
  };

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      {alertMessage && <p className="auth-form__alert" role="alert">{alertMessage}</p>}
      <AuthField
        label="Nombre completo"
        name="name"
        autoComplete="name"
        maxLength={FULL_NAME_MAX_LENGTH}
        value={fullName}
        onChange={setFullName}
        error={messageFor('fullName')}
        inputRef={fullNameRef}
      />
      <AuthField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={messageFor('email')}
        inputRef={emailRef}
      />
      <AuthField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint={PASSWORD_HINT}
        error={messageFor('password')}
        inputRef={passwordRef}
      />
      <button
        type="submit"
        className="auth-button auth-button--primary"
        disabled={busy || !consentAccepted}
      >
        Crear cuenta
      </button>
    </form>
  );
}

SignUpForm.propTypes = {
  consentAccepted: PropTypes.bool.isRequired,
};
