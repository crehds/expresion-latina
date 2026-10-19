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
      SAME_PASSWORD: 'SAME_PASSWORD',
      LINK_EXPIRED: 'LINK_EXPIRED',
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

  describe('for the retryable fetch error of auth-js', () => {
    const retryable = (status) => Object.assign(
      new Error('x'),
      { name: 'AuthRetryableFetchError', status },
    );

    // auth-js reports a request that got no answer with status 0 (fetch.ts:
    // _handleRequest and handleError), and a missing status is no answer either.
    it.each([0, undefined])('maps a request that got no answer (status %s) to NETWORK', (status) => {
      expect(toResultCode(retryable(status))).toBe('NETWORK');
    });

    // The same class also wraps the answers of a failing backend: HTTP 500-504
    // and 520-530 (fetch.ts: NETWORK_ERROR_CODES). The connection worked.
    it.each([500, 501, 502, 503, 504, 520, 525, 530])(
      'maps HTTP %i, an answer of the backend rather than a lost connection, to UNKNOWN',
      (status) => {
        expect(toResultCode(retryable(status))).toBe('UNKNOWN');
      },
    );
  });

  describe('for an error that carries an HTTP status of 500 or more', () => {
    it.each([500, 503, 599])('maps HTTP %i to UNKNOWN whatever else the error says', (status) => {
      expect(toResultCode({ name: 'AuthApiError', status, message: 'x' })).toBe('UNKNOWN');
      expect(toResultCode({ name: 'BackendRequestError', status })).toBe('UNKNOWN');
      // Not even a message that reads like a failed fetch makes it a lost connection.
      expect(toResultCode({ status, message: 'TypeError: Failed to fetch', code: '' })).toBe('UNKNOWN');
    });

    it('leaves a thrown TypeError, which has no status, as NETWORK', () => {
      expect(toResultCode(new TypeError('Failed to fetch dynamically imported module'))).toBe('NETWORK');
    });

    it('does not turn a lower status into UNKNOWN', () => {
      expect(toResultCode({ name: 'AuthApiError', status: 499, code: 'invalid_credentials' }))
        .toBe('INVALID_CREDENTIALS');
      expect(toResultCode({ name: 'AuthApiError', status: 429 })).toBe('RATE_LIMITED');
    });
  });

  it('maps a PostgREST error that carries a fetch failure to NETWORK', () => {
    expect(toResultCode({
      message: 'TypeError: Failed to fetch', details: '', hint: '', code: '',
    })).toBe('NETWORK');
    expect(toResultCode({ message: 'FetchError: socket hang up', code: '' })).toBe('NETWORK');
    expect(toResultCode({ message: 'AbortError: signal is aborted', code: '' })).toBe('NETWORK');
  });

  it('maps a request that was aborted, such as one that timed out, to NETWORK', () => {
    // fetch rejects with a DOMException, whose numeric `code` (20) keeps the
    // message rule above from recognising it: its name is what says "abort".
    const aborted = new DOMException('signal is aborted without reason', 'AbortError');

    expect(aborted.code).toBe(20);
    expect(toResultCode(aborted)).toBe('NETWORK');
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

  describe('for the failures of auth-js that the account forms tell the member about', () => {
    // The code strings are auth-js's ErrorCode (error-codes.d.ts); the status is
    // what GoTrue answers with for each (observed on the local stack for
    // same_password, otp_expired and weak_password).
    it.each([
      ['invalid_credentials', 400, 'INVALID_CREDENTIALS'],
      ['email_not_confirmed', 400, 'EMAIL_NOT_CONFIRMED'],
      ['weak_password', 422, 'WEAK_PASSWORD'],
      ['same_password', 422, 'SAME_PASSWORD'],
      ['otp_expired', 403, 'LINK_EXPIRED'],
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
      expect(toResultCode({ code: 'same_password', status })).toBe('SAME_PASSWORD');
      expect(toResultCode({ code: 'otp_expired', status })).toBe('LINK_EXPIRED');
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
    // Only otp_expired is the answer for an email link that verifyOtp refuses.
    // The flow state codes belong to the PKCE code exchange, not to a link.
    ['a PKCE flow state that expired', {
      name: 'AuthApiError', status: 422, code: 'flow_state_expired', message: 'x',
    }],
    ['a plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('maps %s to UNKNOWN', (_label, error) => {
    expect(toResultCode(error)).toBe('UNKNOWN');
  });
});
