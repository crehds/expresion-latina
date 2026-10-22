/**
 * The self-service deletion of the member's account (Design: D5, D9).
 *
 * A first button only opens a confirmation that names what is erased; the
 * second press deletes. When the deletion works the parent hears about it
 * (`onDeleted`) BEFORE the session is signed out: the page renders its final
 * state first, so the signed-out redirect of the account page cannot win the
 * race. A failed call shows the fixed message of its result code in an alert,
 * never what the backend said, and the account and the session stay as they
 * were. Both buttons are disabled while the call runs.
 *
 * How that sign-out ends is not shown. The provider resolves it to a failure
 * when a session may still be held, but the account is gone and the page says
 * so: there is nothing left the member could do about a session of an account
 * that no longer exists.
 *
 * The page that places the section decides how it sits (a card, how wide): it
 * hands over its own classes in `className`, which are added to the section's.
 */
import PropTypes from 'prop-types';
import {
  useContext, useEffect, useRef, useState,
} from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { useSession } from '../composition/SessionProvider';
import { authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';
import './css/delete-account.css';

export default function DeleteAccount({ onDeleted, className = undefined }) {
  const { services } = useContext(BackendContext);
  const session = useSession();
  const {
    busy, errorCode, run, clear,
  } = useAuthRequest();

  const [confirming, setConfirming] = useState(false);
  const groupRef = useRef(null);
  const openRef = useRef(null);
  // Moves the focus only after the member toggled the confirmation, never on mount.
  const toggledRef = useRef(false);

  useEffect(() => {
    if (!toggledRef.current) {
      return;
    }
    (confirming ? groupRef : openRef).current?.focus();
  }, [confirming]);

  const auth = services?.auth;
  if (!auth) {
    return null;
  }

  const toggle = (next) => {
    toggledRef.current = true;
    clear();
    setConfirming(next);
  };

  const handleConfirm = async () => {
    const outcome = await run(() => auth.deleteMyAccount());
    if (!outcome.ok) {
      return;
    }
    onDeleted();
    try {
      // The result is left unread on purpose (see the top of this file). The provider
      // does not reject, so the catch is only for one that does.
      await session.signOut();
    } catch {
      // The account is gone and the page already says so.
    }
  };

  return (
    <section
      className={className ? `delete-account ${className}` : 'delete-account'}
      aria-labelledby="delete-account-title"
    >
      <h2 className="heading-sm delete-account__title" id="delete-account-title">
        Eliminar mi cuenta
      </h2>
      <p className="text-md delete-account__text">
        Se borran de inmediato tu cuenta, tus pagos registrados y tus confirmaciones de
        asistencia. No se pueden recuperar.
      </p>
      {errorCode && (
        <p className="delete-account__alert" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      {confirming ? (
        <div
          className="delete-account__confirm"
          role="group"
          aria-labelledby="delete-account-question"
          tabIndex={-1}
          ref={groupRef}
        >
          <p className="text-md delete-account__question" id="delete-account-question">
            ¿Seguro? Esta acción no se puede deshacer.
          </p>
          <div className="delete-account__actions">
            <button
              type="button"
              className="auth-button auth-button--primary"
              disabled={busy}
              onClick={handleConfirm}
            >
              Sí, eliminar mi cuenta
            </button>
            <button
              type="button"
              className="auth-button"
              disabled={busy}
              onClick={() => toggle(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="auth-button"
          ref={openRef}
          onClick={() => toggle(true)}
        >
          Eliminar mi cuenta
        </button>
      )}
    </section>
  );
}

DeleteAccount.propTypes = {
  onDeleted: PropTypes.func.isRequired,
  className: PropTypes.string,
};
