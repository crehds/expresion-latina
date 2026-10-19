import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PASSWORD_MIN_LENGTH,
  validateSignIn,
  validateSignUp,
} from './signupValidation';

const CONFIG = path.resolve(__dirname, '../../../../supabase/config.toml');

const VALID = {
  fullName: 'Ana Perez',
  email: 'ana@example.test',
  password: 'abcdefg1',
  consentAccepted: true,
};

const errorsFor = (overrides) => validateSignUp({ ...VALID, ...overrides }).errors;

describe('validateSignUp', () => {
  it('accepts a complete, well-formed sign-up', () => {
    expect(validateSignUp(VALID)).toEqual({ valid: true, errors: {} });
  });

  describe('fullName', () => {
    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['only a tab and a newline', '\t\n'],
      ['missing', undefined],
      ['not a string', 42],
    ])('is required when it is %s', (_label, fullName) => {
      expect(errorsFor({ fullName })).toEqual({ fullName: 'required' });
    });

    it('accepts one character and exactly 120', () => {
      expect(validateSignUp({ ...VALID, fullName: 'A' }).valid).toBe(true);
      expect(validateSignUp({ ...VALID, fullName: 'a'.repeat(120) }).valid).toBe(true);
    });

    it('is too long from 121 characters', () => {
      expect(errorsFor({ fullName: 'a'.repeat(121) })).toEqual({ fullName: 'too_long' });
    });

    it('measures the name after trimming it, like the database does', () => {
      expect(validateSignUp({ ...VALID, fullName: `  ${'a'.repeat(120)}  ` }).valid).toBe(true);
      expect(errorsFor({ fullName: ` ${'a'.repeat(121)} ` })).toEqual({ fullName: 'too_long' });
    });

    it('counts characters, not UTF-16 units: an emoji is one', () => {
      expect(validateSignUp({ ...VALID, fullName: '😀'.repeat(120) }).valid).toBe(true);
      expect(errorsFor({ fullName: '😀'.repeat(121) })).toEqual({ fullName: 'too_long' });
    });
  });

  describe('email', () => {
    it.each([
      'ana@example.test',
      'ana+club@example.test',
      'ana.perez@mail.example.test',
      'a@b',
    ])('accepts %s', (email) => {
      expect(validateSignUp({ ...VALID, email }).valid).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['no @', 'ana.example.test'],
      ['nothing before the @', '@example.test'],
      ['nothing after the @', 'ana@'],
      ['two @', 'ana@@example.test'],
      ['two @ apart', 'ana@example@test'],
      ['a space before the @', 'ana perez@example.test'],
      ['a space after the @', 'ana@exam ple.test'],
      ['a trailing space', 'ana@example.test '],
      ['a tab', 'ana@example.test\t'],
      ['missing', undefined],
      ['not a string', 42],
    ])('rejects an address with %s', (_label, email) => {
      expect(errorsFor({ email })).toEqual({ email: 'invalid' });
    });
  });

  describe('password', () => {
    it('requires at least 8 characters', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
      expect(validateSignUp({ ...VALID, password: 'abcdefg1' }).valid).toBe(true);
      expect(errorsFor({ password: 'abcdef1' })).toEqual({ password: 'too_short' });
    });

    it.each([
      ['empty', ''],
      ['missing', undefined],
      ['letters and a digit but short', 'abc1'],
    ])('is too short when it is %s', (_label, password) => {
      expect(errorsFor({ password })).toEqual({ password: 'too_short' });
    });

    it.each([
      ['only letters', 'abcdefgh'],
      ['only capital letters', 'ABCDEFGH'],
      ['only digits', '12345678'],
      ['only symbols', '!!!!!!!!'],
      ['non-ASCII letters and a digit', 'ñññññññ1'],
      ['letters and non-ASCII digits', 'abcdefg٣'],
    ])('needs a letter and a digit when it is %s', (_label, password) => {
      expect(errorsFor({ password })).toEqual({ password: 'needs_letter_and_digit' });
    });

    it.each([
      'abcdefg1',
      'ABCDEFG1',
      '1abcdefg',
      'contraseña1',
      'abcdef1!',
      'a b c d 1 2',
    ])('accepts %s', (password) => {
      expect(validateSignUp({ ...VALID, password }).valid).toBe(true);
    });
  });

  describe('consent', () => {
    it.each([
      ['not accepted', false],
      ['missing', undefined],
      ['a truthy value that is not true', 'on'],
    ])('is required when it is %s', (_label, consentAccepted) => {
      expect(errorsFor({ consentAccepted })).toEqual({ consent: 'required' });
    });
  });

  it('reports every problem at once, as keys and never as the typed values', () => {
    const result = validateSignUp({
      fullName: '', email: 'nope', password: 'secret-typed', consentAccepted: false,
    });

    expect(result).toEqual({
      valid: false,
      errors: {
        fullName: 'required',
        email: 'invalid',
        password: 'needs_letter_and_digit',
        consent: 'required',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-typed|nope/);
  });

  it('does not throw on an empty call', () => {
    expect(validateSignUp({}).valid).toBe(false);
  });
});

describe('validateSignIn', () => {
  it('accepts an email and a password', () => {
    expect(validateSignIn({ email: 'ana@example.test', password: 'whatever' }))
      .toEqual({ valid: true, errors: {} });
  });

  it('applies no strength rule: the account may predate the rule', () => {
    expect(validateSignIn({ email: 'ana@example.test', password: 'x' }).valid).toBe(true);
    expect(validateSignIn({ email: 'ana@example.test', password: 'abcdefgh' }).valid).toBe(true);
  });

  it('checks the email with the same shape rule as the sign-up', () => {
    expect(validateSignIn({ email: 'ana@@example.test', password: 'x' }).errors)
      .toEqual({ email: 'invalid' });
    expect(validateSignIn({ email: '', password: 'x' }).errors).toEqual({ email: 'invalid' });
    expect(validateSignIn({ email: 'ana example@test', password: 'x' }).errors)
      .toEqual({ email: 'invalid' });
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['missing', undefined],
  ])('requires a password that is not %s', (_label, password) => {
    expect(validateSignIn({ email: 'ana@example.test', password }).errors)
      .toEqual({ password: 'required' });
  });

  it('reports both problems and never the typed values', () => {
    const result = validateSignIn({ email: 'nope', password: '' });

    expect(result).toEqual({
      valid: false,
      errors: { email: 'invalid', password: 'required' },
    });
    expect(JSON.stringify(result)).not.toMatch(/nope/);
  });

  it('does not throw on an empty call', () => {
    expect(validateSignIn({}).valid).toBe(false);
  });
});

// Just enough TOML to read the `key = value` lines of one table, comments
// skipped: a test must not need a parser dependency for two settings.
function tableValues(toml, table) {
  const values = {};
  let current = null;
  toml.split(/\r?\n/).forEach((line) => {
    const [, header] = line.match(/^\[([^\]]+)\]\s*$/) ?? [];
    if (header) {
      current = header;
      return;
    }
    const [, key, value] = line.match(/^([A-Za-z_]+)\s*=\s*(.+?)\s*$/) ?? [];
    if (key && current === table) {
      values[key] = value;
    }
  });
  return values;
}

describe('the local Supabase Auth configuration', () => {
  // The server is the authority; the client rule only has to never be looser.
  // Tying both to the file the local stack starts from keeps them from drifting.
  const auth = tableValues(readFileSync(CONFIG, 'utf8'), 'auth');

  it('requires the same minimum password length as the client', () => {
    expect(auth.minimum_password_length).toBe(String(PASSWORD_MIN_LENGTH));
  });

  it('requires letters and digits, the rule the client mirrors', () => {
    expect(auth.password_requirements).toBe('"letters_digits"');
  });
});
