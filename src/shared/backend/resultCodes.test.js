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

  it.each([
    ['an unmapped Postgres code', { code: '23505', message: 'dup' }],
    ['an auth 500', { name: 'AuthApiError', status: 500, message: 'x' }],
    ['a plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('maps %s to UNKNOWN', (_label, error) => {
    expect(toResultCode(error)).toBe('UNKNOWN');
  });
});
