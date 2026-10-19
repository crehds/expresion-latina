/**
 * Sign in with an email and a password (Design: D5).
 *
 * The fields are checked first (`validateSignIn`), with a message per field and
 * the focus on the first one that is wrong; only a valid form reaches the
 * backend. A failed call shows the fixed message of its result code in an
 * alert, never what the backend said. On success the session is started so the
 * app learns who signed in, and the member goes to the home page; a pending or
 * outdated consent is the consent gate's job from there. If starting the session
 * fails after the password was accepted, the member still goes to the home page
 * and sees no error: the sign-in itself worked.
 *
 * Unlike sign-up and Google, signing in does not wait for the consent
 * checkbox: the account already exists and its consent is on record (spec:
 * Consent Before Account Creation names form sign-up and Google sign-in).
 */
import { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import { useSession } from '../composition/SessionProvider';
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { validateSignIn } from '../domain/signupValidation';
import AuthField from './AuthField';
import { SIGN_IN_MESSAGES, authErrorMessage } from './authCopy';
import ResendConfirmation from './ResendConfirmation';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

// The password was accepted and supabase-js already holds the session, so a
// session that fails to load is not a failed sign-in: the member goes on and
// sees no error, because showing one would send them to type the same password
// again. Nothing else starts the session on the home page, so a rejected start
// is tried once more (the provider lets a failed load be retried); a second
// failure is left for the next page load, which reads the stored session.
async function startSession(session) {
  try {
    await session.start();
  } catch {
    try {
      await session.start();
    } catch {
      // Left for the next page load.
    }
  }
}

export default function SignInForm() {
  const { services } = useContext(BackendContext);
  const session = useSession();
  const navigate = useNavigate();
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const auth = services?.auth;
  if (!auth) {
    return null;
  }

  const messageFor = (field) => (
    errors[field] ? SIGN_IN_MESSAGES[field][errors[field]] : undefined
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const checks = validateSignIn({ email, password });
    setErrors(checks.errors);
    if (!checks.valid) {
      clear();
      (checks.errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    const outcome = await run(async () => {
      const result = await auth.signInWithPassword({ email, password });
      if (result.ok) {
        await startSession(session);
      }
      return result;
    });
    if (outcome.ok) {
      navigate('/', { replace: true });
    }
  };

  return (
    <>
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
          error={messageFor('email')}
          inputRef={emailRef}
        />
        <AuthField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={messageFor('password')}
          inputRef={passwordRef}
        />
        <button type="submit" className="auth-button auth-button--primary" disabled={busy}>
          Ingresar
        </button>
      </form>
      {errorCode === RESULT_CODES.EMAIL_NOT_CONFIRMED && (
        <ResendConfirmation initialEmail={email} />
      )}
    </>
  );
}
