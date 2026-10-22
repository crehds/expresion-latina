/**
 * Continue with Google (Design: D5.3).
 *
 * It renders only when the backend says the Google provider is on (the public
 * Auth settings, through `auth.getProviders()`), so it never leads to an
 * "Unsupported provider" page. Until the answer arrives, and whenever the read
 * fails, it renders nothing.
 *
 * One failed read must not hide the button for good, because a member who signs
 * in only with Google would have no way in. A read that fails for a reason that
 * may pass (no connection, too many requests, an error of the backend) is
 * repeated twice more, after half a second and then after a second and a half.
 * If the last one fails too, the button stays hidden until the page is loaded
 * again. Any other failure, such as a refused key, is not repeated.
 *
 * Google cannot carry the consent with the request, so the accepted notice
 * version is kept in sessionStorage BEFORE the flow starts: the page is left for
 * Google, and on `/auth/callback` the consent gate records the stored version.
 * If the flow does not start, the stored version is removed again. The button
 * waits for the consent checkbox of the page (`consentAccepted`).
 *
 * The page may hand over the checkbox itself (`consentField`) for the view where
 * Google is the only thing it gates. The button is what knows whether Google is
 * on, so it draws the field above itself and only when it draws itself: a visitor
 * is never asked to accept something that gates nothing.
 */
import PropTypes from 'prop-types';
import { useContext, useEffect, useState } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';
import { authCallbackUrl } from '../domain/authRedirect';
import {
  CURRENT_NOTICE_VERSION,
  clearPendingConsentVersion,
  storePendingConsentVersion,
} from '../domain/noticeVersion';
import { authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

// The pause before each repeat of a failed read; the read is tried once more
// for every entry.
const RETRY_DELAYS_MS = [500, 1500];

// The failures that may pass by themselves. A refused key or an unexpected
// answer will not, so asking again would only delay the same result.
const RETRYABLE_CODES = new Set([
  RESULT_CODES.NETWORK,
  RESULT_CODES.RATE_LIMITED,
  RESULT_CODES.UNKNOWN,
]);

// Whether the backend offers Google. False until it says so, and false again if
// the service is replaced, until the new one says so. Whatever a read or a
// pending repeat does after the component left or the service changed is
// dropped: it never sets state and its timer is cleared.
function useGoogleAvailable(auth) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(false);
    if (!auth) {
      return undefined;
    }
    let cancelled = false;
    let timer = null;

    const read = async (attempt) => {
      let result;
      try {
        result = await auth.getProviders();
      } catch {
        // Not knowing is the same as "off", and it may pass like any other
        // unexpected failure.
        result = fail(RESULT_CODES.UNKNOWN);
      }
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setAvailable(result.data.google === true);
      } else if (RETRYABLE_CODES.has(result.code) && attempt < RETRY_DELAYS_MS.length) {
        timer = setTimeout(() => read(attempt + 1), RETRY_DELAYS_MS[attempt]);
      }
    };
    read(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [auth]);

  return available;
}

export default function GoogleButton({ consentAccepted, consentField = null }) {
  const { services } = useContext(BackendContext);
  const auth = services?.auth;
  const { busy, errorCode, run } = useAuthRequest();
  const available = useGoogleAvailable(auth);

  if (!auth || !available) {
    return null;
  }

  const handleClick = async () => {
    storePendingConsentVersion(CURRENT_NOTICE_VERSION);
    const outcome = await run(() => auth.signInWithGoogle({ redirectTo: authCallbackUrl() }));
    if (!outcome.ok) {
      clearPendingConsentVersion();
    }
  };

  return (
    <div className="auth-google">
      {consentField}
      {errorCode && (
        <p className="auth-form__alert" role="alert">{authErrorMessage(errorCode)}</p>
      )}
      <button
        type="button"
        className="auth-button"
        disabled={busy || !consentAccepted}
        onClick={handleClick}
      >
        Continuar con Google
      </button>
    </div>
  );
}

GoogleButton.propTypes = {
  consentAccepted: PropTypes.bool.isRequired,
  consentField: PropTypes.node,
};
