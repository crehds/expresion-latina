/**
 * The result every adapter call returns (Design: Interfaces).
 *
 * An adapter never throws: it returns `{ ok: true, data }` or
 * `{ ok: false, code }`. A failure carries only a code from this set, never the
 * member data or the raw error message of the backend, so nothing personal can
 * leak through an error path.
 */

export const RESULT_CODES = Object.freeze({
  NETWORK: 'NETWORK',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID: 'INVALID',
  // The four below are the failures of a password sign-in or sign-up that the
  // forms tell the member about.
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN',
});

export const ok = (data) => ({ ok: true, data });

export const fail = (code) => ({ ok: false, code });

// PostgREST reports a failed fetch as `${error.name}: ${error.message}` with an
// empty code and status 0 (postgrest-js PostgrestBuilder.then).
const FETCH_FAILURE_MESSAGE = /^(TypeError|FetchError|AbortError)\b/;

const INVALID_CODES = new Set(['22023', '23514', '22P02']);

// auth-js reports a GoTrue failure with a string `code` (its ErrorCode type).
// A Map, so that an inherited name such as "constructor" is never a code.
const AUTH_CODES = new Map([
  ['invalid_credentials', RESULT_CODES.INVALID_CREDENTIALS],
  ['email_not_confirmed', RESULT_CODES.EMAIL_NOT_CONFIRMED],
  ['weak_password', RESULT_CODES.WEAK_PASSWORD],
  ['over_request_rate_limit', RESULT_CODES.RATE_LIMITED],
  ['over_email_send_rate_limit', RESULT_CODES.RATE_LIMITED],
  ['over_sms_send_rate_limit', RESULT_CODES.RATE_LIMITED],
]);

// An HTTP answer of 500 or more means the backend was reached and failed. It is
// not a lost connection, so the member is not told to check their internet.
// auth-js wraps the answers 500-504 and 520-530 as AuthRetryableFetchError (its
// NETWORK_ERROR_CODES), which is why the class alone cannot tell the two apart.
const isServerFailure = (error) => typeof error.status === 'number' && error.status >= 500;

function isNetworkFailure(error) {
  return error instanceof TypeError
    // fetch rejects an aborted request (a timeout, a cancel) with a
    // DOMException. Its numeric `code` keeps the message rule below from
    // recognising it, so the name is what is read.
    || error.name === 'AbortError'
    // auth-js wraps a request that got no answer this way, with status 0. It
    // wraps some server answers the same way: those are told apart first.
    || error.name === 'AuthRetryableFetchError'
    || (!error.code && FETCH_FAILURE_MESSAGE.test(error.message ?? ''));
}

/**
 * Maps whatever a backend call raised or returned as `error` (a thrown
 * `TypeError`, an auth-js error or a PostgREST error object) to one result
 * code.
 */
export function toResultCode(error) {
  if (!error || typeof error !== 'object') {
    return RESULT_CODES.UNKNOWN;
  }
  // Before the network rules: only a request without an answer is NETWORK.
  if (isServerFailure(error)) {
    return RESULT_CODES.UNKNOWN;
  }
  if (isNetworkFailure(error)) {
    return RESULT_CODES.NETWORK;
  }
  // Before the generic 401/403 rule below, which they could collide with.
  if (AUTH_CODES.has(error.code)) {
    return AUTH_CODES.get(error.code);
  }
  if (error.status === 429) {
    return RESULT_CODES.RATE_LIMITED;
  }
  if (error.code === '42501' || error.status === 401 || error.status === 403) {
    return RESULT_CODES.FORBIDDEN;
  }
  if (error.code === 'P0002') {
    return RESULT_CODES.NOT_FOUND;
  }
  if (INVALID_CODES.has(error.code)) {
    return RESULT_CODES.INVALID;
  }
  return RESULT_CODES.UNKNOWN;
}
