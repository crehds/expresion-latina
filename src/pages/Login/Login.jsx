import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Page } from '../../components';
import { useSession } from '../../features/accounts/composition/SessionProvider';
import ConsentCheckbox from '../../features/accounts/ui/ConsentCheckbox';
import GoogleButton from '../../features/accounts/ui/GoogleButton';
import PasswordResetForm from '../../features/accounts/ui/PasswordResetForm';
import SignInForm from '../../features/accounts/ui/SignInForm';
import SignUpForm from '../../features/accounts/ui/SignUpForm';

import './css/login.css';

const TITLES = {
  signIn: 'Ingresar',
  signUp: 'Crear cuenta',
  reset: 'Restablecer contraseña',
};

/**
 * Where a visitor signs in, creates an account or continues with Google
 * (Design: D5, D10).
 *
 * The consent checkbox shows only where it gates something. On "Crear cuenta" it
 * is the last field of the form, right before the "Crear cuenta" button (the form
 * is handed the box), and only creating an account waits for it. On "Ingresar" there
 * is no box, because that account already exists and its consent is on record.
 * "Continuar con Google" never waits for a box on either view: it says right under
 * itself that continuing accepts the privacy notice. The accepted state is the
 * page's, so it survives the switch between the two views. The page starts the session on
 * mount: a stored session is found by the provider on its own, but a visitor
 * who has none must not be left waiting for something that never starts. A
 * member who is already signed in is sent to the home page. Whatever consent is
 * still pending after a sign-in is the consent gate's job, not this page's.
 *
 * A member who forgot the password asks for a reset link from here: that view
 * leaves out the consent box and Google, which have nothing to do with it.
 */
export default function Login() {
  const { status, start } = useSession();
  const location = useLocation();
  // An expired recovery link sends the member here to ask for a new one.
  const [view, setView] = useState(location.state?.forgotPassword ? 'reset' : 'signIn');
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    start();
  }, [start]);

  if (status === 'signed-in') {
    return <Navigate to="/" replace />;
  }

  const signingUp = view === 'signUp';
  const resetting = view === 'reset';
  const consentBox = <ConsentCheckbox checked={consentAccepted} onChange={setConsentAccepted} />;

  return (
    <Page title={TITLES[view]} className="login">
      <div className="login__panel">
        {resetting ? <PasswordResetForm /> : (
          <>
            {signingUp
              ? <SignUpForm consentAccepted={consentAccepted} consentField={consentBox} />
              : <SignInForm />}
            {!signingUp && (
              <p className="login__forgot">
                <button
                  type="button"
                  className="login__switch-button"
                  onClick={() => setView('reset')}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </p>
            )}
            <GoogleButton />
          </>
        )}
        <p className="login__switch">
          {signingUp && '¿Ya tienes cuenta?'}
          {resetting && '¿Recordaste tu contraseña?'}
          {view === 'signIn' && '¿Aún no tienes cuenta?'}
          {' '}
          <button
            type="button"
            className="login__switch-button"
            onClick={() => setView(view === 'signIn' ? 'signUp' : 'signIn')}
          >
            {view === 'signIn' ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </p>
      </div>
    </Page>
  );
}
