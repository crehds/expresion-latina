import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { Page } from '../../components';
import { useSession } from '../../features/accounts/composition/SessionProvider';
import DeleteAccount from '../../features/accounts/ui/DeleteAccount';
import NewPassword from '../../features/accounts/ui/NewPassword';
import { authErrorMessage } from '../../features/accounts/ui/authCopy';
import startSession from '../../features/accounts/ui/startSession';
import { RESULT_CODES } from '../../shared/backend/resultCodes';

import './css/account.css';

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' });

const consentLine = ({ consentVersion, consentAt }) => (
  `Aceptaste el aviso de privacidad versión ${consentVersion} el ${dateFormat.format(new Date(consentAt))}.`
);

/**
 * The signed-in member's own account (Design: D5, D9, D10).
 *
 * The page starts the session on mount, like the login page: a visitor with no
 * stored session must not be left waiting for something that never starts. A
 * visitor, or an error with no session behind it, is sent to the login page; a
 * pending or outdated consent is the consent gate's job, which wraps the routes.
 *
 * It shows who the member is and the consent on record, signs this device out
 * (and goes home), changes the password (the other devices are signed out by
 * the form) and deletes the account. Once the account is deleted the page shows
 * its final state and stays there: the sign-out that follows must not send the
 * member to the login page.
 */
export default function Account() {
  const session = useSession();
  const { status, profile, start } = session;
  const navigate = useNavigate();
  const [deleted, setDeleted] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  // Set before this device signs out, so the signed-out status that follows goes
  // home (the button's destination) and not to the login page.
  const leavingRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    startSession({ start });
  }, [start]);

  if (deleted) {
    return (
      <Page title="Cuenta eliminada" titleHidden className="account">
        <p className="text-md account__message" role="status">Tu cuenta fue eliminada.</p>
        <Link className="account__link" to="/">Ir al inicio</Link>
      </Page>
    );
  }

  const noSession = status === 'signed-out' || (status === 'error' && !session.session);
  if (noSession && !leavingRef.current) {
    return <Navigate to="/login" replace />;
  }

  if (status === 'error') {
    return (
      <Page title="Mi cuenta" className="account">
        <p className="text-md account__message" role="alert">
          No pudimos cargar tu cuenta. Inténtalo de nuevo.
        </p>
        <button type="button" className="auth-button account__button" onClick={() => startSession({ start })}>
          Reintentar
        </button>
      </Page>
    );
  }

  if (status !== 'signed-in' || !profile) {
    return (
      <Page title="Mi cuenta" className="account">
        <p className="text-md account__message" role="status">Cargando tu cuenta…</p>
      </Page>
    );
  }

  // A failed sign-out leaves the member here, with a way to try again; a
  // second click while one is running is ignored.
  const signOut = async () => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await session.signOut();
      navigate('/');
    } catch {
      leavingRef.current = false;
      setSigningOut(false);
      setSignOutFailed(true);
    }
  };

  return (
    <Page title="Mi cuenta" className="account">
      <div className="account__body">
        <section className="account__section" aria-labelledby="account-profile-title">
          <h2 className="heading-sm account__heading" id="account-profile-title">Mis datos</h2>
          <dl className="text-md account__details">
            <div>
              <dt>Nombre</dt>
              <dd>{profile.fullName}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{session.session.email}</dd>
            </div>
          </dl>
          {profile.consentAt && (
            <p className="text-md account__text">{consentLine(profile)}</p>
          )}
          <Link className="account__link" to="/privacy">Ver el aviso de privacidad</Link>
          {signOutFailed && (
            <p className="text-md account__message" role="alert">
              {authErrorMessage(RESULT_CODES.UNKNOWN)}
            </p>
          )}
          <button
            type="button"
            className="auth-button account__button"
            onClick={signOut}
            disabled={signingOut}
          >
            Cerrar sesión
          </button>
        </section>

        <section className="account__section" aria-labelledby="account-password-title">
          <h2 className="heading-sm account__heading" id="account-password-title">
            Cambiar contraseña
          </h2>
          {passwordChanged ? (
            <p className="text-md account__message" role="status">Tu contraseña se actualizó.</p>
          ) : (
            <NewPassword onDone={() => setPasswordChanged(true)} />
          )}
        </section>

        <DeleteAccount onDeleted={() => setDeleted(true)} />
      </div>
    </Page>
  );
}
