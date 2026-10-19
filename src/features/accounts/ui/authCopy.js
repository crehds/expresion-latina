/**
 * The Spanish copy of the account controls: sign-in, sign-up, Google, the
 * password reset and the new password.
 *
 * Every message is fixed text. A failed call shows the message of its result
 * code and nothing the backend said, so no raw error and no member data can
 * reach the screen. Validation keys map to messages here too: the validators
 * return keys only (`signupValidation.js`), and a test checks that none of
 * their keys is left without a message.
 */
import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import { FULL_NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/signupValidation';

const PASSWORD_RULE = `${PASSWORD_MIN_LENGTH} caracteres, con letras y números.`;

export const PASSWORD_HINT = `Mínimo ${PASSWORD_RULE}`;
export const CONSENT_REQUIRED = 'Acepta el Aviso de privacidad para continuar.';
export const CONFIRMATION_SENT = 'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';
export const DEFAULT_ERROR = 'No pudimos completar la acción. Inténtalo de nuevo.';

// A Map, so that an inherited name such as "constructor" is never a code.
const ERROR_MESSAGES = new Map([
  [RESULT_CODES.INVALID_CREDENTIALS, 'Correo o contraseña incorrectos.'],
  [
    RESULT_CODES.EMAIL_NOT_CONFIRMED,
    'Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.',
  ],
  [RESULT_CODES.WEAK_PASSWORD, `La contraseña debe tener al menos ${PASSWORD_RULE}`],
  [RESULT_CODES.SAME_PASSWORD, 'La nueva contraseña debe ser distinta de la actual.'],
  [RESULT_CODES.LINK_EXPIRED, 'El enlace venció o ya se usó. Pide uno nuevo.'],
  [RESULT_CODES.RATE_LIMITED, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
  [RESULT_CODES.NETWORK, 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
]);

/** The message for the code of a failed call; any code without its own gets the generic one. */
export const authErrorMessage = (code) => ERROR_MESSAGES.get(code) ?? DEFAULT_ERROR;

const EMAIL_INVALID = 'Escribe un correo válido.';

/** `SIGN_UP_MESSAGES[field][problem]`, for the keys `validateSignUp` reports. */
export const SIGN_UP_MESSAGES = {
  fullName: {
    required: 'Escribe tu nombre completo.',
    too_long: `El nombre puede tener hasta ${FULL_NAME_MAX_LENGTH} caracteres.`,
  },
  email: { invalid: EMAIL_INVALID },
  password: {
    too_short: 'La contraseña es muy corta.',
    needs_letter_and_digit: 'La contraseña debe incluir letras y números.',
  },
  consent: { required: CONSENT_REQUIRED },
};

/** `SIGN_IN_MESSAGES[field][problem]`, for the keys `validateSignIn` reports. */
export const SIGN_IN_MESSAGES = {
  email: { invalid: EMAIL_INVALID },
  password: { required: 'Escribe tu contraseña.' },
};
