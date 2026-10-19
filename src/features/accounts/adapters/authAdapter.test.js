import { BackendRequestError } from '../../../shared/backend/errors';
import { createAuthAdapter } from './authAdapter';

const RAW_SESSION = {
  access_token: 'secret-access',
  refresh_token: 'secret-refresh',
  user: { id: 'user-1', email: 'ana@example.test', phone: '123' },
};

const PROFILE_ROW = {
  id: 'user-1',
  full_name: 'Ana Perez',
  consent_version: '2026-01-01',
  consent_at: '2026-10-01T10:00:00+00:00',
  is_admin: false,
};

const OAUTH_URL = 'https://abcd1234.supabase.co/auth/v1/authorize?provider=google&code_challenge=secret-challenge';

// What auth-js answers with when a call fails: no user and no session.
const NO_USER = { user: null, session: null };

// A fake supabase client: every call is recorded and answers what the test set.
function fakeClient({
  session = RAW_SESSION,
  sessionError = null,
  profile = PROFILE_ROW,
  profileError = null,
  rpcError = null,
  signOutError = null,
  signUpSession = null,
  signUpError = null,
  signInError = null,
  oauthError = null,
  resetError = null,
  updateError = null,
  verifyError = null,
  resendError = null,
} = {}) {
  const calls = {};
  const unsubscribe = vi.fn();
  const query = {
    select: vi.fn((columns) => { calls.select = columns; return query; }),
    eq: vi.fn((column, value) => { calls.eq = [column, value]; return query; }),
    maybeSingle: vi.fn(async () => ({ data: profile, error: profileError })),
  };
  return {
    calls,
    unsubscribe,
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: sessionError })),
      onAuthStateChange: vi.fn((callback) => {
        calls.authCallback = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
      signOut: vi.fn(async () => ({ error: signOutError })),
      signUp: vi.fn(async (credentials) => {
        calls.signUp = credentials;
        return signUpError
          ? { data: NO_USER, error: signUpError }
          : { data: { user: RAW_SESSION.user, session: signUpSession }, error: null };
      }),
      signInWithPassword: vi.fn(async (credentials) => {
        calls.signInWithPassword = credentials;
        return signInError
          ? { data: NO_USER, error: signInError }
          : { data: { user: RAW_SESSION.user, session: RAW_SESSION }, error: null };
      }),
      signInWithOAuth: vi.fn(async (credentials) => {
        calls.signInWithOAuth = credentials;
        return oauthError
          ? { data: { provider: 'google', url: null, flowId: null }, error: oauthError }
          : { data: { provider: 'google', url: OAUTH_URL, flowId: null }, error: null };
      }),
      resetPasswordForEmail: vi.fn(async (email, options) => {
        calls.resetPasswordForEmail = [email, options];
        return resetError ? { data: null, error: resetError } : { data: {}, error: null };
      }),
      updateUser: vi.fn(async (attributes) => {
        calls.updateUser = attributes;
        return updateError
          ? { data: { user: null }, error: updateError }
          : { data: { user: RAW_SESSION.user }, error: null };
      }),
      resend: vi.fn(async (credentials) => {
        calls.resend = credentials;
        return resendError ? { data: NO_USER, error: resendError } : { data: NO_USER, error: null };
      }),
      verifyOtp: vi.fn(async (params) => {
        calls.verifyOtp = params;
        return verifyError
          ? { data: NO_USER, error: verifyError }
          : { data: { user: RAW_SESSION.user, session: RAW_SESSION }, error: null };
      }),
    },
    from: vi.fn((table) => { calls.table = table; return query; }),
    rpc: vi.fn(async (name, args) => {
      calls.rpc = [name, args];
      return { data: null, error: rpcError };
    }),
  };
}

const adapterFor = (client) => createAuthAdapter(vi.fn(async () => client));

describe('createAuthAdapter', () => {
  it('does not ask for the client when it is created', () => {
    const getClient = vi.fn();

    createAuthAdapter(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  describe('getSession', () => {
    it('returns only the user id and email, never a token', async () => {
      const result = await adapterFor(fakeClient()).getSession();

      expect(result).toEqual({ ok: true, data: { userId: 'user-1', email: 'ana@example.test' } });
      expect(JSON.stringify(result)).not.toMatch(/secret|123/);
    });

    it('returns null data when nobody is signed in', async () => {
      const result = await adapterFor(fakeClient({ session: null })).getSession();

      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps an auth error to a code only', async () => {
      const sessionError = { name: 'AuthRetryableFetchError', message: 'private detail', status: 0 };

      const result = await adapterFor(fakeClient({ sessionError })).getSession();

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('subscribe', () => {
    it('hands the callback the minimal session, or null on sign-out', async () => {
      const client = fakeClient();
      const callback = vi.fn();

      const result = await adapterFor(client).subscribe(callback);
      client.calls.authCallback('SIGNED_IN', RAW_SESSION);
      client.calls.authCallback('SIGNED_OUT', null);

      expect(result.ok).toBe(true);
      expect(callback).toHaveBeenNthCalledWith(1, { userId: 'user-1', email: 'ana@example.test' });
      expect(callback).toHaveBeenNthCalledWith(2, null);
    });

    it('returns a function that unsubscribes', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).subscribe(vi.fn());
      result.data();

      expect(client.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOwnProfile', () => {
    it('reads the own profiles row and maps it to camelCase', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).getOwnProfile('user-1');

      expect(client.calls.table).toBe('profiles');
      expect(client.calls.select).toBe('id, full_name, consent_version, consent_at, is_admin');
      expect(client.calls.eq).toEqual(['id', 'user-1']);
      expect(result).toEqual({
        ok: true,
        data: {
          id: 'user-1',
          fullName: 'Ana Perez',
          consentVersion: '2026-01-01',
          consentAt: '2026-10-01T10:00:00+00:00',
          isAdmin: false,
        },
      });
    });

    it('keeps a pending profile pending: consentAt stays null', async () => {
      const pending = {
        ...PROFILE_ROW, full_name: '', consent_version: null, consent_at: null,
      };

      const result = await adapterFor(fakeClient({ profile: pending })).getOwnProfile('user-1');

      expect(result.data.consentAt).toBeNull();
      expect(result.data.consentVersion).toBeNull();
    });

    it('returns null data when there is no row', async () => {
      const result = await adapterFor(fakeClient({ profile: null })).getOwnProfile('user-1');

      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps a PostgREST error to a code only', async () => {
      const profileError = { code: '42501', message: 'row-level security detail' };

      const result = await adapterFor(fakeClient({ profile: null, profileError }))
        .getOwnProfile('user-1');

      expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
    });
  });

  describe('recordConsent', () => {
    it('calls record_consent with its p_version parameter', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).recordConsent('2026-01-01');

      expect(client.calls.rpc).toEqual(['record_consent', { p_version: '2026-01-01' }]);
      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps an unknown version (22023) to INVALID', async () => {
      const rpcError = { code: '22023', message: 'unknown privacy notice version: x' };

      const result = await adapterFor(fakeClient({ rpcError })).recordConsent('x');

      expect(result).toEqual({ ok: false, code: 'INVALID' });
    });
  });

  describe('deleteMyAccount', () => {
    it('calls delete_my_account without arguments', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).deleteMyAccount();

      expect(client.calls.rpc).toEqual(['delete_my_account', undefined]);
      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps a missing account (P0002) to NOT_FOUND', async () => {
      const rpcError = { code: 'P0002', message: 'no account was deleted' };

      const result = await adapterFor(fakeClient({ rpcError })).deleteMyAccount();

      expect(result).toEqual({ ok: false, code: 'NOT_FOUND' });
    });
  });

  describe('signOut', () => {
    // auth-js signs out every device by default (scope 'global'); the button
    // must only end this one.
    it('signs out this device only', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).signOut();

      expect(client.auth.signOut).toHaveBeenCalledTimes(1);
      expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps a sign-out error to a code only', async () => {
      const signOutError = { name: 'AuthApiError', status: 403, message: 'x' };

      const result = await adapterFor(fakeClient({ signOutError })).signOut();

      expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
    });
  });

  describe('signOutOthers', () => {
    // After a password change: every other device must sign in again, and this
    // one must stay signed in.
    it('signs out every device except this one', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).signOutOthers();

      expect(client.auth.signOut).toHaveBeenCalledTimes(1);
      expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
      expect(result).toEqual({ ok: true, data: null });
    });

    it('maps a sign-out error to a code only', async () => {
      const signOutError = { name: 'AuthApiError', status: 403, message: 'x' };

      const result = await adapterFor(fakeClient({ signOutError })).signOutOthers();

      expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
    });
  });

  // auth-js errors as GoTrue answers with them (error-codes.d.ts).
  const authError = (code, status) => ({
    name: 'AuthApiError', code, status, message: 'private detail ana@example.test',
  });
  const offline = { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' };

  const SIGN_UP = {
    email: 'ana@example.test',
    password: 'abcdefg1',
    fullName: 'Ana Perez',
    consentVersion: '2026-01-01',
    redirectTo: 'https://app.example.test/auth/callback',
  };

  describe('signUp', () => {
    it('sends the credentials, the name and the accepted version as sign-up data', async () => {
      const client = fakeClient();

      await adapterFor(client).signUp(SIGN_UP);

      expect(client.calls.signUp).toStrictEqual({
        email: 'ana@example.test',
        password: 'abcdefg1',
        options: {
          data: { full_name: 'Ana Perez', consent_version: '2026-01-01' },
          emailRedirectTo: 'https://app.example.test/auth/callback',
        },
      });
    });

    it('reports a pending confirmation when no session came back', async () => {
      const result = await adapterFor(fakeClient()).signUp(SIGN_UP);

      expect(result).toEqual({ ok: true, data: { confirmationPending: true } });
    });

    it('reports no pending confirmation when a session came back, and returns no token', async () => {
      const result = await adapterFor(fakeClient({ signUpSession: RAW_SESSION })).signUp(SIGN_UP);

      expect(result).toEqual({ ok: true, data: { confirmationPending: false } });
      expect(JSON.stringify(result)).not.toMatch(/secret|123/);
    });

    it.each(['user_already_exists', 'email_exists'])(
      'answers an address that is already registered (%s) like a new one',
      async (code) => {
        const signUpError = authError(code, 422);

        const result = await adapterFor(fakeClient({ signUpError })).signUp(SIGN_UP);

        expect(result).toEqual({ ok: true, data: { confirmationPending: true } });
        expect(JSON.stringify(result)).not.toMatch(/ana@example|private detail|exists/);
      },
    );

    it.each([
      ['weak_password', 422, 'WEAK_PASSWORD'],
      ['over_email_send_rate_limit', 429, 'RATE_LIMITED'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['signup_disabled', 422, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ signUpError: authError(code, status) }))
        .signUp(SIGN_UP);

      expect(result).toEqual({ ok: false, code: expected });
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ signUpError: offline })).signUp(SIGN_UP);

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });

    it('maps a backend that failed, such as a sign-up trigger that raised (HTTP 500), to UNKNOWN', async () => {
      // auth-js wraps HTTP 500 as a retryable fetch error, but it did get through.
      const failed = { name: 'AuthRetryableFetchError', status: 500, message: 'Database error saving new user' };

      const result = await adapterFor(fakeClient({ signUpError: failed })).signUp(SIGN_UP);

      expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
    });
  });

  describe('signInWithPassword', () => {
    it('signs in with the email and the password and returns no session', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).signInWithPassword({
        email: 'ana@example.test', password: 'abcdefg1',
      });

      expect(client.calls.signInWithPassword).toStrictEqual({
        email: 'ana@example.test', password: 'abcdefg1',
      });
      expect(result).toEqual({ ok: true, data: null });
      expect(JSON.stringify(result)).not.toMatch(/secret|123/);
    });

    it.each([
      ['invalid_credentials', 400, 'INVALID_CREDENTIALS'],
      ['email_not_confirmed', 400, 'EMAIL_NOT_CONFIRMED'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['user_already_exists', 422, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ signInError: authError(code, status) }))
        .signInWithPassword({ email: 'ana@example.test', password: 'abcdefg1' });

      expect(result).toEqual({ ok: false, code: expected });
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ signInError: offline }))
        .signInWithPassword({ email: 'ana@example.test', password: 'abcdefg1' });

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('signInWithGoogle', () => {
    it('starts the Google flow with the redirect target and returns nothing', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).signInWithGoogle({
        redirectTo: 'https://app.example.test/auth/callback',
      });

      expect(client.calls.signInWithOAuth).toStrictEqual({
        provider: 'google',
        options: { redirectTo: 'https://app.example.test/auth/callback' },
      });
      expect(result).toEqual({ ok: true, data: null });
      expect(JSON.stringify(result)).not.toMatch(/secret|authorize/);
    });

    it.each([
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['oauth_provider_not_supported', 400, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ oauthError: authError(code, status) }))
        .signInWithGoogle({ redirectTo: 'https://app.example.test/auth/callback' });

      expect(result).toEqual({ ok: false, code: expected });
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ oauthError: offline }))
        .signInWithGoogle({ redirectTo: 'https://app.example.test/auth/callback' });

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('requestPasswordReset', () => {
    const REQUEST = { email: 'ana@example.test', redirectTo: 'https://app.example.test/auth/confirm' };

    it('asks for the reset email with the address and the redirect target and returns nothing', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).requestPasswordReset(REQUEST);

      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
      expect(client.calls.resetPasswordForEmail).toStrictEqual([
        'ana@example.test',
        { redirectTo: 'https://app.example.test/auth/confirm' },
      ]);
      expect(result).toEqual({ ok: true, data: null });
    });

    it.each([
      ['over_email_send_rate_limit', 429, 'RATE_LIMITED'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['email_address_invalid', 400, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s and never echoes the address', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ resetError: authError(code, status) }))
        .requestPasswordReset(REQUEST);

      expect(result).toEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(/ana@example|private detail/);
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ resetError: offline }))
        .requestPasswordReset(REQUEST);

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('resendConfirmation', () => {
    const REQUEST = { email: 'ana@example.test', redirectTo: 'https://app.example.test/auth/callback' };

    it('asks for a new sign-up confirmation email for the address and returns nothing', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).resendConfirmation(REQUEST);

      expect(client.auth.resend).toHaveBeenCalledTimes(1);
      expect(client.calls.resend).toStrictEqual({
        type: 'signup',
        email: 'ana@example.test',
        options: { emailRedirectTo: 'https://app.example.test/auth/callback' },
      });
      expect(result).toEqual({ ok: true, data: null });
    });

    it('works without a redirect target, which is what the app sends', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).resendConfirmation({ email: 'ana@example.test' });

      expect(client.calls.resend).toStrictEqual({
        type: 'signup',
        email: 'ana@example.test',
        options: { emailRedirectTo: undefined },
      });
      expect(result).toEqual({ ok: true, data: null });
    });

    it.each([
      ['over_email_send_rate_limit', 429, 'RATE_LIMITED'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['email_address_invalid', 400, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s and never echoes the address', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ resendError: authError(code, status) }))
        .resendConfirmation(REQUEST);

      expect(result).toEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(/ana@example|private detail/);
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ resendError: offline }))
        .resendConfirmation(REQUEST);

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('updatePassword', () => {
    it('sets the new password for the signed-in member and returns nothing', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).updatePassword({ password: ' new pass1 ' });

      expect(client.auth.updateUser).toHaveBeenCalledTimes(1);
      expect(client.calls.updateUser).toStrictEqual({ password: ' new pass1 ' });
      expect(result).toEqual({ ok: true, data: null });
      expect(JSON.stringify(result)).not.toMatch(/new pass1|secret|ana@example/);
    });

    it.each([
      ['same_password', 422, 'SAME_PASSWORD'],
      ['weak_password', 422, 'WEAK_PASSWORD'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['reauthentication_needed', 400, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ updateError: authError(code, status) }))
        .updatePassword({ password: 'abcdefg1' });

      expect(result).toEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(/abcdefg1|private detail/);
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ updateError: offline }))
        .updatePassword({ password: 'abcdefg1' });

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('verifyEmailLink', () => {
    it.each(['recovery', 'email'])('verifies the token hash of a %s link and returns nothing, not even the session', async (type) => {
      const client = fakeClient();

      const result = await adapterFor(client).verifyEmailLink({ tokenHash: 'hash-1', type });

      expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1);
      expect(client.calls.verifyOtp).toStrictEqual({ token_hash: 'hash-1', type });
      expect(result).toEqual({ ok: true, data: null });
      expect(JSON.stringify(result)).not.toMatch(/secret|ana@example/);
    });

    it.each([
      ['signup', 'signup'],
      ['magiclink', 'magiclink'],
      ['invite', 'invite'],
      ['email_change', 'email_change'],
      ['a phone type', 'sms'],
      ['another case', 'RECOVERY'],
      ['padded with a space', 'recovery '],
      ['an empty string', ''],
      ['missing', undefined],
      ['null', null],
      ['not a string', ['recovery']],
      ['an inherited property name', 'constructor'],
    ])('refuses the type %s as INVALID, without asking for the client or calling verifyOtp', async (_label, type) => {
      const getClient = vi.fn(async () => fakeClient());

      const result = await createAuthAdapter(getClient).verifyEmailLink({ tokenHash: 'hash-1', type });

      expect(result).toEqual({ ok: false, code: 'INVALID' });
      expect(getClient).not.toHaveBeenCalled();
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['missing', undefined],
      ['null', null],
      ['not a string', 42],
    ])('refuses a token hash that is %s as INVALID, without calling verifyOtp', async (_label, tokenHash) => {
      const client = fakeClient();

      const result = await adapterFor(client).verifyEmailLink({ tokenHash, type: 'recovery' });

      expect(result).toEqual({ ok: false, code: 'INVALID' });
      expect(client.auth.verifyOtp).not.toHaveBeenCalled();
    });

    it('does not throw on an empty call', async () => {
      await expect(adapterFor(fakeClient()).verifyEmailLink())
        .resolves.toEqual({ ok: false, code: 'INVALID' });
    });

    it.each([
      ['otp_expired', 403, 'LINK_EXPIRED'],
      ['over_request_rate_limit', 429, 'RATE_LIMITED'],
      ['unexpected_failure', 500, 'UNKNOWN'],
    ])('maps the auth error %s (HTTP %i) to %s', async (code, status, expected) => {
      const result = await adapterFor(fakeClient({ verifyError: authError(code, status) }))
        .verifyEmailLink({ tokenHash: 'hash-1', type: 'recovery' });

      expect(result).toEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(/hash-1|private detail/);
    });

    it('maps a transport failure to NETWORK', async () => {
      const result = await adapterFor(fakeClient({ verifyError: offline }))
        .verifyEmailLink({ tokenHash: 'hash-1', type: 'email' });

      expect(result).toEqual({ ok: false, code: 'NETWORK' });
    });
  });

  describe('getProviders', () => {
    const adapterWith = (fetchSettings, getClient = vi.fn()) => createAuthAdapter(
      getClient,
      { fetchSettings },
    );

    it('reports Google as available when the backend settings enable it', async () => {
      const fetchSettings = vi.fn(async () => ({ external: { google: true, email: true } }));

      const result = await adapterWith(fetchSettings).getProviders();

      expect(fetchSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true, data: { google: true } });
    });

    it.each([
      ['disabled', { external: { google: false } }],
      ['missing', { external: { email: true } }],
      ['the string "true"', { external: { google: 'true' } }],
      ['the number 1', { external: { google: 1 } }],
      ['without an external block', { disable_signup: false }],
      ['null', null],
      ['not an object', 'settings'],
    ])('reports Google as unavailable when the setting is %s', async (_label, settings) => {
      const result = await adapterWith(async () => settings).getProviders();

      expect(result).toEqual({ ok: true, data: { google: false } });
    });

    it('returns the flag and nothing else of the settings', async () => {
      const settings = { external: { google: true }, sms_provider: 'twilio', saml_enabled: true };

      const result = await adapterWith(async () => settings).getProviders();

      expect(Object.keys(result.data)).toEqual(['google']);
    });

    it.each([
      ['a network failure', new TypeError('Failed to fetch'), 'NETWORK'],
      ['a request that timed out', new DOMException('signal is aborted without reason', 'AbortError'), 'NETWORK'],
      ['a refusal for too many requests', new BackendRequestError(429), 'RATE_LIMITED'],
      ['a refusal of the key', new BackendRequestError(401), 'FORBIDDEN'],
      ['a server error', new BackendRequestError(503), 'UNKNOWN'],
      ['anything else', new Error('private detail ana@example.test'), 'UNKNOWN'],
    ])('maps %s to a code only', async (_label, failure, expected) => {
      const result = await adapterWith(async () => { throw failure; }).getProviders();

      expect(result).toEqual({ ok: false, code: expected });
    });

    it('does not ask for the client: the settings are a plain read', async () => {
      const getClient = vi.fn();

      await adapterWith(async () => ({}), getClient).getProviders();

      expect(getClient).not.toHaveBeenCalled();
    });

    it('fails closed when it was given no way to read the settings', async () => {
      await expect(createAuthAdapter(vi.fn()).getProviders())
        .resolves.toEqual({ ok: false, code: 'UNKNOWN' });
    });
  });

  describe('when the client cannot be obtained', () => {
    const methods = [
      ['getSession', (a) => a.getSession()],
      ['subscribe', (a) => a.subscribe(vi.fn())],
      ['getOwnProfile', (a) => a.getOwnProfile('user-1')],
      ['recordConsent', (a) => a.recordConsent('2026-01-01')],
      ['deleteMyAccount', (a) => a.deleteMyAccount()],
      ['signOut', (a) => a.signOut()],
      ['signOutOthers', (a) => a.signOutOthers()],
      ['signUp', (a) => a.signUp(SIGN_UP)],
      ['signInWithPassword', (a) => a.signInWithPassword({ email: 'ana@example.test', password: 'x' })],
      ['signInWithGoogle', (a) => a.signInWithGoogle({ redirectTo: 'https://app.example.test/auth/callback' })],
      ['requestPasswordReset', (a) => a.requestPasswordReset({ email: 'ana@example.test', redirectTo: 'https://app.example.test/auth/confirm' })],
      ['resendConfirmation', (a) => a.resendConfirmation({ email: 'ana@example.test', redirectTo: 'https://app.example.test/auth/callback' })],
      ['updatePassword', (a) => a.updatePassword({ password: 'abcdefg1' })],
      ['verifyEmailLink', (a) => a.verifyEmailLink({ tokenHash: 'hash-1', type: 'recovery' })],
    ];

    it.each(methods)('%s resolves to NETWORK when the dynamic import fails', async (_name, call) => {
      const adapter = createAuthAdapter(
        () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      );

      await expect(call(adapter)).resolves.toEqual({ ok: false, code: 'NETWORK' });
    });

    it.each(methods)('%s resolves to UNKNOWN for any other failure and never throws', async (_name, call) => {
      const adapter = createAuthAdapter(
        () => Promise.reject(new Error('The backend is not configured')),
      );

      await expect(call(adapter)).resolves.toEqual({ ok: false, code: 'UNKNOWN' });
    });

    it('resolves to a code when the client throws mid-call', async () => {
      const client = fakeClient();
      client.auth.getSession = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

      await expect(adapterFor(client).getSession()).resolves.toEqual({ ok: false, code: 'NETWORK' });
    });
  });
});
