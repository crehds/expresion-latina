import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { Page } from '../../components';
import { useSession } from '../../features/accounts/composition/SessionProvider';
import DeleteAccount from '../../features/accounts/ui/DeleteAccount';
import NewPassword from '../../features/accounts/ui/NewPassword';
import { SIGN_OUT_FAILED } from '../../features/accounts/ui/authCopy';
import startSession from '../../features/accounts/ui/startSession';

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
 * the form) and deletes the account. Each of those is a card: the data of the
 * member with the sign-out, the password, and last, on the whole width because it
 * is the destructive one, the deletion. The stylesheet puts the cards in one column
 * on a phone and in two from 768px, and the cards stay in the order of the document,
 * so what is read, tabbed and seen agree. Once the account is deleted the page shows
 * its final state and stays there: the sign-out that follows must not send the
 * member to the login page.
 *
 * The sign-out goes home only when the session says this device holds no session
 * any more. When one may still be held, the member stays here with an alert that
 * says so, and the button works again; leaving them on the home page, signed in,
 * would let them believe they had signed out of a shared device.
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
  // second click while one is running is ignored. The provider resolves to a
  // result and does not throw, but a rejection is a failure here too, since the
  // member must never be sent home on a guess.
  const signOut = async () => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setSigningOut(true);
    setSignOutFailed(false);
    let signedOut = false;
    try {
      signedOut = (await session.signOut()).ok === true;
    } catch {
      // Left as a failure.
    }
    if (signedOut) {
      navigate('/');
    } else {
      leavingRef.current = false;
      setSigningOut(false);
      setSignOutFailed(true);
    }
  };

  return (
    <Page title="Mi cuenta" className="account">
      <div className="account__body">
        <section
          className="account__card account__section"
          aria-labelledby="account-profile-title"
        >
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
          {signOutFailed && (
            <p className="text-md account__message" role="alert">{SIGN_OUT_FAILED}</p>
          )}
          <div className="account__actions">
            <Link className="account__link" to="/privacy">Ver el aviso de privacidad</Link>
            <button
              type="button"
              className="auth-button account__button"
              onClick={signOut}
              disabled={signingOut}
            >
              Cerrar sesión
            </button>
          </div>
        </section>

        <section
          className="account__card account__section account__section--form"
          aria-labelledby="account-password-title"
        >
          <h2 className="heading-sm account__heading" id="account-password-title">
            Cambiar contraseña
          </h2>
          {passwordChanged ? (
            <p className="text-md account__message" role="status">Tu contraseña se actualizó.</p>
          ) : (
            <NewPassword onDone={() => setPasswordChanged(true)} />
          )}
        </section>

        <DeleteAccount
          className="account__card account__card--wide"
          onDeleted={() => setDeleted(true)}
        />
      </div>
    </Page>
  );
}
