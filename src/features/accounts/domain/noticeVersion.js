/**
 * The privacy notice version and the pending consent (Design: D5).
 *
 * Consent is given in the UI before any sign-in starts. A Google sign-in leaves
 * the page and comes back to `/auth/callback`, so the accepted version is kept
 * in sessionStorage (it survives the same-tab round trip) until the callback
 * records it with `record_consent` and clears it. Every storage access is
 * guarded: a blocked storage behaves as "nothing stored", and the consent gate
 * then asks again.
 */

/** Must be a row of `privacy_notice_versions`; a test ties it to the migration seed. */
export const CURRENT_NOTICE_VERSION = '2026-01-01';

const PENDING_CONSENT_KEY = 'expresion-latina:pending-consent-version';

export function storePendingConsentVersion(version) {
  try {
    window.sessionStorage.setItem(PENDING_CONSENT_KEY, version);
  } catch {
    // Blocked storage: the consent gate asks after the callback instead.
  }
}

export function readPendingConsentVersion() {
  try {
    return window.sessionStorage.getItem(PENDING_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function clearPendingConsentVersion() {
  try {
    window.sessionStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    // Nothing to clear if the storage cannot be reached.
  }
}
