import {
  RESULT_CODES, fail, ok, toResultCode,
} from './resultCodes';

describe('RESULT_CODES', () => {
  it('is the frozen set of adapter result codes', () => {
    expect(RESULT_CODES).toEqual({
      NETWORK: 'NETWORK',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
      INVALID: 'INVALID',
      INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
      EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
      WEAK_PASSWORD: 'WEAK_PASSWORD',
      RATE_LIMITED: 'RATE_LIMITED',
      UNKNOWN: 'UNKNOWN',
    });
    expect(Object.isFrozen(RESULT_CODES)).toBe(true);
  });
});

describe('ok and fail', () => {
  it('wrap data in a success result', () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
    expect(ok(null)).toEqual({ ok: true, data: null });
  });

  it('carry only the code in a failure result', () => {
    expect(fail('FORBIDDEN')).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('toResultCode', () => {
  it('maps a thrown fetch TypeError to NETWORK', () => {
    expect(toResultCode(new TypeError('Failed to fetch'))).toBe('NETWORK');
  });

  it('maps an auth-js retryable fetch error to NETWORK, whatever its status', () => {
    const offline = Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 });
    const unavailable = Object.assign(new Error('HTTP 503'), { name: 'AuthRetryableFetchError', status: 503 });

    expect(toResultCode(offline)).toBe('NETWORK');
    expect(toResultCode(unavailable)).toBe('NETWORK');
  });

  it('maps a PostgREST error that carries a fetch failure to NETWORK', () => {
    expect(toResultCode({
      message: 'TypeError: Failed to fetch', details: '', hint: '', code: '',
    })).toBe('NETWORK');
    expect(toResultCode({ message: 'FetchError: socket hang up', code: '' })).toBe('NETWORK');
    expect(toResultCode({ message: 'AbortError: signal is aborted', code: '' })).toBe('NETWORK');
  });

  it.each([
    ['a Postgres insufficient_privilege', { code: '42501', message: 'x' }],
    ['an auth 401', { name: 'AuthApiError', status: 401, message: 'x' }],
    ['an auth 403', { name: 'AuthApiError', status: 403, message: 'x' }],
  ])('maps %s to FORBIDDEN', (_label, error) => {
    expect(toResultCode(error)).toBe('FORBIDDEN');
  });

  it('maps P0002 to NOT_FOUND', () => {
    expect(toResultCode({ code: 'P0002', message: 'no profile found' })).toBe('NOT_FOUND');
  });

  it.each(['22023', '23514', '22P02'])('maps %s to INVALID', (code) => {
    expect(toResultCode({ code, message: 'x' })).toBe('INVALID');
  });

  describe('for the sign-in and sign-up failures of auth-js', () => {
    // The code strings are auth-js's ErrorCode (error-codes.d.ts); the status is
    // what GoTrue answers with for each.
    it.each([
      ['invalid_credentials', 400, 'INVALID_CREDENTIALS'],
      ['email_not_confirmed', 400, 'EMAIL_NOT_CONFIRMED'],
      ['weak_password', 422, 'WEAK_PASSWORD'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['over_email_send_rate_limit', 429, 'RATE_LIMITED'],
      ['over_sms_send_rate_limit', 429, 'RATE_LIMITED'],
    ])('maps the code %s (HTTP %i) to %s', (code, status, expected) => {
      expect(toResultCode({
        name: 'AuthApiError', code, status, message: 'x',
      })).toBe(expected);
    });

    it('maps the error auth-js builds for a weak password, with its reasons', () => {
      const weak = Object.assign(new Error('Password should contain letters and digits.'), {
        name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', reasons: ['characters'],
      });

      expect(toResultCode(weak)).toBe('WEAK_PASSWORD');
    });

    it('maps any HTTP 429 to RATE_LIMITED, even without a code', () => {
      expect(toResultCode({ name: 'AuthApiError', status: 429, message: 'x' })).toBe('RATE_LIMITED');
    });

    it.each([401, 403])('reads the code before the generic %i FORBIDDEN rule', (status) => {
      expect(toResultCode({ code: 'invalid_credentials', status })).toBe('INVALID_CREDENTIALS');
      expect(toResultCode({ code: 'email_not_confirmed', status })).toBe('EMAIL_NOT_CONFIRMED');
      expect(toResultCode({ code: 'weak_password', status })).toBe('WEAK_PASSWORD');
      expect(toResultCode({ code: 'over_request_rate_limit', status })).toBe('RATE_LIMITED');
    });

    it('never mistakes an inherited property name for a code', () => {
      expect(toResultCode({ code: 'constructor', status: 400 })).toBe('UNKNOWN');
      expect(toResultCode({ code: 'toString', status: 400 })).toBe('UNKNOWN');
    });
  });

  it.each([
    ['an unmapped Postgres code', { code: '23505', message: 'dup' }],
    ['an auth 500', { name: 'AuthApiError', status: 500, message: 'x' }],
    ['an auth 422 whose code the adapter handles on its own', {
      name: 'AuthApiError', status: 422, code: 'user_already_exists', message: 'x',
    }],
    ['a plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('maps %s to UNKNOWN', (_label, error) => {
    expect(toResultCode(error)).toBe('UNKNOWN');
  });
});
