/**
 * Continue with Google (Design: D5.3).
 *
 * It renders only when the backend says the Google provider is on (the public
 * Auth settings, through `auth.getProviders()`), so it never leads to an
 * "Unsupported provider" page. Until the answer arrives, and whenever the read
 * fails, it renders nothing.
 *
 * Google cannot carry the consent with the request, so the accepted notice
 * version is kept in sessionStorage BEFORE the flow starts: the page is left for
 * Google, and on `/auth/callback` the consent gate records the stored version.
 * If the flow does not start, the stored version is removed again. The button
 * waits for the consent checkbox of the page (`consentAccepted`).
 */
import PropTypes from 'prop-types';
import { useContext, useEffect, useState } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { authCallbackUrl } from '../domain/authRedirect';
import {
  CURRENT_NOTICE_VERSION,
  clearPendingConsentVersion,
  storePendingConsentVersion,
} from '../domain/noticeVersion';
import { authErrorMessage } from './authCopy';
import useAuthRequest from './useAuthRequest';
import './css/auth-forms.css';

export default function GoogleButton({ consentAccepted }) {
  const { services } = useContext(BackendContext);
  const auth = services?.auth;
  const { busy, errorCode, run } = useAuthRequest();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!auth) {
      return;
    }
    (async () => {
      try {
        const result = await auth.getProviders();
        setAvailable(result.ok && result.data.google === true);
      } catch {
        // Not knowing is the same as "off": the button stays hidden.
      }
    })();
  }, [auth]);

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
};
