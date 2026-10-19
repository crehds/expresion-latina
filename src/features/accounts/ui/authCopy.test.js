import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateSignIn,
  validateSignUp,
} from '../domain/signupValidation';
import {
  CONFIRMATION_SENT,
  CONSENT_REQUIRED,
  DEFAULT_ERROR,
  PASSWORD_HINT,
  SIGN_IN_MESSAGES,
  SIGN_UP_MESSAGES,
  authErrorMessage,
} from './authCopy';

describe('authErrorMessage', () => {
  it.each([
    [RESULT_CODES.INVALID_CREDENTIALS, 'Correo o contraseña incorrectos.'],
    [
      RESULT_CODES.EMAIL_NOT_CONFIRMED,
      'Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.',
    ],
    [
      RESULT_CODES.WEAK_PASSWORD,
      'La contraseña debe tener al menos 8 caracteres, con letras y números.',
    ],
    [RESULT_CODES.SAME_PASSWORD, 'La nueva contraseña debe ser distinta de la actual.'],
    [RESULT_CODES.LINK_EXPIRED, 'El enlace venció o ya se usó. Pide uno nuevo.'],
    [RESULT_CODES.RATE_LIMITED, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [RESULT_CODES.NETWORK, 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
  ])('tells the member what to do after %s', (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it.each([
    RESULT_CODES.UNKNOWN,
    RESULT_CODES.FORBIDDEN,
    RESULT_CODES.NOT_FOUND,
    RESULT_CODES.INVALID,
    'SOMETHING_NEW',
    'constructor',
    undefined,
    null,
  ])('falls back to the generic message for %s', (code) => {
    expect(authErrorMessage(code)).toBe(DEFAULT_ERROR);
    expect(DEFAULT_ERROR).toBe('No pudimos completar la acción. Inténtalo de nuevo.');
  });

  it('states the same password rule the validation enforces', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(authErrorMessage(RESULT_CODES.WEAK_PASSWORD)).toContain(`${PASSWORD_MIN_LENGTH} caracteres`);
    expect(PASSWORD_HINT).toBe('Mínimo 8 caracteres, con letras y números.');
  });
});

describe('the sign-up and sign-in field messages', () => {
  const VALID_SIGN_UP = {
    fullName: 'Ana Perez', email: 'ana@example.test', password: 'abcdefg1', consentAccepted: true,
  };

  // Every problem a validator can report, found by feeding it bad input.
  const problemsOf = (validate, inputs) => inputs.flatMap(
    (input) => Object.entries(validate(input).errors),
  );

  it('covers every problem the sign-up validation can report', () => {
    const problems = problemsOf(validateSignUp, [
      {
        fullName: '', email: '', password: '', consentAccepted: false,
      },
      { ...VALID_SIGN_UP, fullName: 'a'.repeat(FULL_NAME_MAX_LENGTH + 1) },
      { ...VALID_SIGN_UP, password: 'abcdefgh' },
    ]);

    expect(new Set(problems.map(([field, problem]) => `${field}:${problem}`))).toEqual(new Set([
      'fullName:required',
      'fullName:too_long',
      'email:invalid',
      'password:too_short',
      'password:needs_letter_and_digit',
      'consent:required',
    ]));
    problems.forEach(([field, problem]) => {
      expect(SIGN_UP_MESSAGES[field][problem]).toEqual(expect.any(String));
      expect(SIGN_UP_MESSAGES[field][problem]).not.toBe('');
    });
  });

  it('covers every problem the sign-in validation can report', () => {
    const problems = problemsOf(validateSignIn, [{ email: '', password: '' }]);

    expect(problems.map(([field, problem]) => `${field}:${problem}`).sort())
      .toEqual(['email:invalid', 'password:required']);
    problems.forEach(([field, problem]) => {
      expect(SIGN_IN_MESSAGES[field][problem]).toEqual(expect.any(String));
    });
  });

  it('says the limits it enforces', () => {
    expect(SIGN_UP_MESSAGES.fullName.too_long).toContain(String(FULL_NAME_MAX_LENGTH));
    expect(SIGN_UP_MESSAGES.consent.required).toBe(CONSENT_REQUIRED);
  });

  it('reads as plain Spanish in the "tú" form', () => {
    expect(SIGN_UP_MESSAGES.fullName.required).toBe('Escribe tu nombre completo.');
    expect(SIGN_UP_MESSAGES.email.invalid).toBe('Escribe un correo válido.');
    expect(SIGN_UP_MESSAGES.password.too_short).toBe('La contraseña es muy corta.');
    expect(SIGN_UP_MESSAGES.password.needs_letter_and_digit)
      .toBe('La contraseña debe incluir letras y números.');
    expect(SIGN_IN_MESSAGES.password.required).toBe('Escribe tu contraseña.');
    expect(CONSENT_REQUIRED).toBe('Acepta el Aviso de privacidad para continuar.');
    expect(CONFIRMATION_SENT)
      .toBe('Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.');
  });
});
