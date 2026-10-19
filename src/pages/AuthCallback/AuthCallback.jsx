import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { Page } from '../../components';
import { useSession } from '../../features/accounts/composition/SessionProvider';

import './css/auth-callback.css';

// Auth reports a failed return as `error` in the query (the PKCE flow) or in the
// fragment. Only its presence matters: the description is never shown.
const reportsError = ({ search, hash }) => (
  new URLSearchParams(search).has('error')
  || new URLSearchParams(hash.replace(/^#/, '')).has('error')
);

/**
 * Where Supabase Auth sends the browser back to (Design: D5, D10).
 *
 * The page does almost nothing. supabase-js exchanges the `?code=` of the
 * address itself while it initializes, and `getSession()` waits for that, so
 * this page never calls `exchangeCodeForSession`: a second exchange would race
 * the first and burn the single-use code verifier. It starts the session (a
 * fresh return has none stored for the app to find by itself) and then:
 *
 * - signed in: goes to the home page. A consent that is still pending (a first
 *   Google sign-in) is the consent gate's job, which wraps the routes.
 * - no session and no error: the address was confirmed, but this browser holds
 *   no code verifier for the link (it was opened elsewhere), so the member
 *   signs in with the password.
 * - an error in the address, or a session that could not be loaded: a fixed
 *   message. What Auth said about the error is never shown.
 */
export default function AuthCallback() {
  const { status, start } = useSession();
  const location = useLocation();

  useEffect(() => {
    start();
  }, [start]);

  if (status === 'signed-in') {
    return <Navigate to="/" replace />;
  }

  const checking = status === 'idle' || status === 'loading';
  const failed = status === 'error' || reportsError(location);

  return (
    <Page title="Ingresar" className="auth-callback">
      {checking && <p className="text-md" role="status">Verificando tu acceso…</p>}
      {!checking && failed && (
        <p className="text-md auth-callback__message" role="alert">
          No pudimos completar el ingreso. Inténtalo de nuevo.
        </p>
      )}
      {!checking && !failed && (
        <p className="text-md auth-callback__message" role="status">
          Tu correo está confirmado. Ingresa con tu correo y contraseña.
        </p>
      )}
      {!checking && (
        <Link className="auth-callback__link" to="/login">Ir a ingresar</Link>
      )}
    </Page>
  );
}
