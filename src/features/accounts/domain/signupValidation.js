/**
 * Checks for the sign-up and sign-in forms (Design: D5.2).
 *
 * They only save the member a round trip. The server stays the authority (the
 * `auth.users` trigger and the Auth settings in `supabase/config.toml`), so no
 * rule here is looser than the server's. Results hold KEYS only, never the typed
 * values or any copy; the forms map each key to its message.
 *
 * The name is judged after `trim()`, so the form must send the trimmed name.
 */

/** Must equal `minimum_password_length` of `supabase/config.toml`; a test ties them. */
export const PASSWORD_MIN_LENGTH = 8;

/** The limit `private.full_name_max_length()` enforces in the sign-up trigger. */
export const FULL_NAME_MAX_LENGTH = 120;

const asText = (value) => (typeof value === 'string' ? value : '');

function fullNameError(fullName) {
  const name = asText(fullName).trim();
  if (name === '') {
    return 'required';
  }
  // Postgres counts characters, so an emoji is one and not two UTF-16 units.
  return [...name].length > FULL_NAME_MAX_LENGTH ? 'too_long' : null;
}

// Only the shape; the server decides whether the address is acceptable.
function emailError(email) {
  const address = asText(email);
  if (/\s/.test(address)) {
    return 'invalid';
  }
  const parts = address.split('@');
  return parts.length === 2 && parts[0] !== '' && parts[1] !== '' ? null : 'invalid';
}

// `password_requirements = "letters_digits"`. The server counts bytes, which
// are never fewer than the UTF-16 units counted here, so this is never looser.
function passwordError(password) {
  const text = asText(password);
  if (text.length < PASSWORD_MIN_LENGTH) {
    return 'too_short';
  }
  return /[A-Za-z]/.test(text) && /[0-9]/.test(text) ? null : 'needs_letter_and_digit';
}

// `checks` are [field, problem] pairs; only the fields with a problem are kept.
function result(checks) {
  const errors = Object.fromEntries(checks.filter(([, problem]) => problem !== null));
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * `errors` may hold `fullName` ('required' | 'too_long'), `email` ('invalid'),
 * `password` ('too_short' | 'needs_letter_and_digit') and `consent`
 * ('required').
 */
export function validateSignUp({
  fullName, email, password, consentAccepted,
} = {}) {
  return result([
    ['fullName', fullNameError(fullName)],
    ['email', emailError(email)],
    ['password', passwordError(password)],
    ['consent', consentAccepted === true ? null : 'required'],
  ]);
}

/**
 * `errors` may hold `email` ('invalid') and `password` ('required'). There is no
 * strength rule: an existing account may predate it.
 */
export function validateSignIn({ email, password } = {}) {
  return result([
    ['email', emailError(email)],
    ['password', asText(password).trim() === '' ? 'required' : null],
  ]);
}
