import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { Page } from '../../components';
import { useSession } from '../../features/accounts/composition/SessionProvider';
import ConsentCheckbox from '../../features/accounts/ui/ConsentCheckbox';
import GoogleButton from '../../features/accounts/ui/GoogleButton';
import SignInForm from '../../features/accounts/ui/SignInForm';
import SignUpForm from '../../features/accounts/ui/SignUpForm';

import './css/login.css';

/**
 * Where a visitor signs in, creates an account or continues with Google
 * (Design: D5, D10).
 *
 * The consent checkbox sits above the forms and the Google button. Creating an
 * account and Google wait for it; signing in does not, because that account
 * already exists and its consent is on record. The page starts the session on
 * mount: a stored session is found by the provider on its own, but a visitor
 * who has none must not be left waiting for something that never starts. A
 * member who is already signed in is sent to the home page. Whatever consent is
 * still pending after a sign-in is the consent gate's job, not this page's.
 */
export default function Login() {
  const { status, start } = useSession();
  const [signingUp, setSigningUp] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    start();
  }, [start]);

  if (status === 'signed-in') {
    return <Navigate to="/" replace />;
  }

  return (
    <Page title={signingUp ? 'Crear cuenta' : 'Ingresar'} className="login">
      <div className="login__panel">
        <ConsentCheckbox checked={consentAccepted} onChange={setConsentAccepted} />
        {signingUp ? <SignUpForm consentAccepted={consentAccepted} /> : <SignInForm />}
        <GoogleButton consentAccepted={consentAccepted} />
        <p className="login__switch">
          {signingUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
          {' '}
          <button
            type="button"
            className="login__switch-button"
            onClick={() => setSigningUp(!signingUp)}
          >
            {signingUp ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </Page>
  );
}
