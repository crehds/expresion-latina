/**
 * Blocks the app until the member's consent is recorded (Design: D5).
 *
 * It wraps the routes and reads the session. A pending profile (`consentAt`
 * null, a Google sign-up before the consent was recorded) or one whose recorded
 * notice is older than the current one gets this screen instead of the page.
 * Everyone else, including visitors and a disabled backend, sees the children
 * untouched.
 *
 * - A pending profile with an accepted version kept in sessionStorage (the
 *   Google round trip) first records that version automatically, with a short
 *   loading state: it records the version, clears the storage and refreshes the
 *   profile. Whatever the outcome, the loading state then ends. When the
 *   refreshed profile is current, the gate lets the page through; when it is
 *   still pending or outdated (the stored version was older than the current
 *   notice) or the recording failed, the member gets the screen below.
 * - Otherwise the member accepts, which records the current version, or
 *   declines, which deletes the account and signs out.
 *
 * `/privacy` is never covered, so the notice can be read from here. A failed
 * call, or one that rejects, shows a short fixed message on the screen, never
 * member data or the raw error, and the buttons work again.
 */
import PropTypes from 'prop-types';
import {
  useContext, useEffect, useRef, useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import {
  CURRENT_NOTICE_VERSION,
  clearPendingConsentVersion,
  readPendingConsentVersion,
} from '../domain/noticeVersion';
import { useSession } from '../composition/SessionProvider';
import './css/consent-gate.css';

const PRIVACY_PATH = '/privacy';

const isPending = (profile) => profile.consentAt === null;

// Notice versions are ISO dates, so the string order is the date order.
const isOutdated = (profile) => (
  typeof profile.consentVersion === 'string' && profile.consentVersion < CURRENT_NOTICE_VERSION
);

const ERROR_COPY = {
  [RESULT_CODES.NETWORK]: 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  default: 'No pudimos completar la acción. Inténtalo de nuevo.',
};

// Runs `action` (it resolves to a result) and then `onSuccess`. Resolves to
// null on success, to the code of a failed result, or to UNKNOWN (the default
// message) when anything rejected. It never rejects, so a caller cannot be left
// waiting on it.
async function attempt(action, onSuccess) {
  try {
    const result = await action();
    if (!result.ok) {
      return result.code;
    }
    await onSuccess();
    return null;
  } catch {
    return RESULT_CODES.UNKNOWN;
  }
}

// A recorded consent spends the stored version; the profile is read again.
const afterRecording = (session) => async () => {
  clearPendingConsentVersion();
  await session.refresh();
};

function ConsentPrompt({ profile }) {
  const { services } = useContext(BackendContext);
  const session = useSession();
  const auth = services?.auth;

  const [storedVersion] = useState(() => (isPending(profile) ? readPendingConsentVersion() : null));
  const [phase, setPhase] = useState(storedVersion ? 'auto' : 'screen');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const headingRef = useRef(null);
  const autoStartedRef = useRef(false);

  // The accepted version travels through the Google round trip; record it once.
  // Whatever happens, the loading state ends on the screen: if the refreshed
  // profile is current the gate unmounts this prompt, otherwise (still pending,
  // outdated, or a failure with its code) the member gets the buttons.
  useEffect(() => {
    if (phase !== 'auto' || autoStartedRef.current || !auth) {
      return;
    }
    autoStartedRef.current = true;
    (async () => {
      const code = await attempt(
        () => auth.recordConsent(storedVersion),
        afterRecording(session),
      );
      setErrorCode(code);
      setPhase('screen');
    })();
  }, [phase, auth, storedVersion, session]);

  useEffect(() => {
    if (phase === 'screen') {
      headingRef.current?.focus();
    }
  }, [phase]);

  if (!auth) {
    return null;
  }

  const run = async (action, onSuccess) => {
    setBusy(true);
    setErrorCode(null);
    try {
      setErrorCode(await attempt(action, onSuccess));
    } finally {
      setBusy(false);
    }
  };

  const accept = () => run(
    () => auth.recordConsent(CURRENT_NOTICE_VERSION),
    afterRecording(session),
  );

  // The result of the sign-out is left unread on purpose: the provider resolves
  // it to a failure when a session may still be held, but the account is already
  // deleted and there is nothing the member could do about that session.
  const decline = () => run(
    () => auth.deleteMyAccount(),
    () => session.signOut(),
  );

  if (phase === 'auto') {
    return (
      <main className="page consent-gate" aria-busy="true">
        <p className="text-md consent-gate__status" role="status">Guardando tu consentimiento…</p>
      </main>
    );
  }

  return (
    <main className="page consent-gate">
      <h1 className="heading-md consent-gate__title" ref={headingRef} tabIndex={-1}>
        Necesitamos tu consentimiento
      </h1>
      <p className="text-md">
        {isPending(profile)
          ? 'Para mantener tu cuenta y sus datos, la academia necesita tu consentimiento.'
          : 'Actualizamos el aviso de privacidad. Para seguir con tu cuenta, necesitamos que lo aceptes de nuevo.'}
      </p>
      <p className="text-md">
        Si no aceptas, eliminaremos tu cuenta. Lee el
        {' '}
        <Link className="consent-gate__link" to={PRIVACY_PATH}>Aviso de privacidad</Link>
        .
      </p>
      {errorCode && (
        <p className="text-md consent-gate__error" role="alert">
          {ERROR_COPY[errorCode] ?? ERROR_COPY.default}
        </p>
      )}
      <div className="consent-gate__actions">
        <button
          type="button"
          className="consent-gate__button consent-gate__button--primary"
          disabled={busy}
          onClick={accept}
        >
          Acepto
        </button>
        <button
          type="button"
          className="consent-gate__button"
          disabled={busy}
          onClick={decline}
        >
          No acepto, eliminar mi cuenta
        </button>
      </div>
    </main>
  );
}

ConsentPrompt.propTypes = {
  profile: PropTypes.shape({
    consentAt: PropTypes.string,
    consentVersion: PropTypes.string,
  }).isRequired,
};

export default function ConsentGate({ children }) {
  const { status, profile } = useSession();
  const { pathname } = useLocation();

  const needsConsent = status === 'signed-in'
    && profile !== null
    && (isPending(profile) || isOutdated(profile))
    && pathname !== PRIVACY_PATH;

  return needsConsent ? <ConsentPrompt profile={profile} /> : children;
}

ConsentGate.propTypes = {
  children: PropTypes.node.isRequired,
};
