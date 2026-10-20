/**
 * The only door between the accounts feature and Supabase Auth (Design: D5,
 * D10).
 *
 * `createAuthAdapter(getClient, { fetchSettings })` takes the lazy client getter
 * and calls it only when a method runs, so creating the adapter never loads
 * supabase-js. `fetchSettings` reads the backend's public Auth settings; like
 * `getClient` it is injected by the composition root, so the adapter knows
 * nothing of the build configuration and a test can hand it any answer. Every
 * method resolves to a result (`ok` / `fail`) and never throws: a rejected
 * `getClient()` (a failed dynamic import is a network failure) and any error
 * the client returns are mapped to a result code. A session leaves this module
 * as `{ userId, email }`, never with its tokens, and the sign-in methods and the
 * email link verification return nothing at all (the session stays inside
 * supabase-js).
 */
import { createRequestRunner } from '../../../shared/backend/requestRunner';
import {
  RESULT_CODES, fail, ok, toResultCode,
} from '../../../shared/backend/resultCodes';

const PROFILE_COLUMNS = 'id, full_name, consent_version, consent_at, is_admin';

// Depending on its settings, Supabase answers a sign-up for a registered address
// with an obfuscated success or with one of these errors. Both end as "check
// your email", so the form cannot be used to find out who has an account.
const ALREADY_REGISTERED = new Set(['user_already_exists', 'email_exists']);

// The email links the app verifies (Design: D10, "email links use token_hash
// plus verifyOtp"): the password recovery link, and the confirmation link of a
// new account (`email`; `signup` is deprecated). verifyOtp would also verify an
// invite, a magic link, an email change or a phone code from a link a stranger
// crafted, so every other type is refused before a request is made.
const LINK_TYPES = new Set(['recovery', 'email']);

const toSession = (session) => (
  session ? { userId: session.user.id, email: session.user.email } : null
);

const toProfile = (row) => (row ? {
  id: row.id,
  fullName: row.full_name,
  consentVersion: row.consent_version,
  consentAt: row.consent_at,
  isAdmin: row.is_admin,
} : null);

export function createAuthAdapter(getClient, { fetchSettings = null } = {}) {
  // Runs `call(client)` and turns whatever it returns or throws into a result.
  // `call` returns `{ error, data }`-shaped values; `read` maps `data` on success.
  const run = createRequestRunner(getClient);

  return {
    getSession: () => run(
      (client) => client.auth.getSession(),
      (data) => toSession(data.session),
    ),

    // The subscription is created inside `read`, so it only exists on success.
    subscribe: (callback) => run(
      async (client) => ({
        data: client.auth.onAuthStateChange((_event, session) => callback(toSession(session))),
        error: null,
      }),
      (data) => () => data.data.subscription.unsubscribe(),
    ),

    getOwnProfile: (userId) => run(
      (client) => client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
      toProfile,
    ),

    recordConsent: (version) => run(
      (client) => client.rpc('record_consent', { p_version: version }),
      () => null,
    ),

    deleteMyAccount: () => run(
      (client) => client.rpc('delete_my_account'),
      () => null,
    ),

    // Ends this device's session only. auth-js signs out every device by
    // default (`scope: 'global'`), which a button on one device must not do.
    //
    // The result says whether this device still holds a session, which is not the
    // same as whether the request worked. When the request fails (no connection,
    // a server error) auth-js removes the local session anyway and reports the
    // error; when the stored access token has expired and the refresh fails
    // offline, it gives up before removing anything, and the session stays. Asking
    // `getSession()` tells them apart, and it is asked only after a failure. It
    // fails closed: only "no session" together with no error says the session is
    // gone, and a session, an error, an answer that is not understood or a call
    // that throws all mean one may still be held, which is reported as the failure
    // of the request.
    signOut: () => run(
      async (client) => {
        const outcome = await client.auth.signOut({ scope: 'local' });
        if (!outcome.error) {
          return { data: null, error: null };
        }
        const remaining = await client.auth.getSession();
        const gone = !remaining?.error && remaining?.data?.session === null;
        return { data: null, error: gone ? null : outcome.error };
      },
      () => null,
    ),

    // Ends every session except this device's: what follows a password change,
    // so a device that stole or kept the old session has to sign in again.
    signOutOthers: () => run(
      async (client) => ({ data: null, ...(await client.auth.signOut({ scope: 'others' })) }),
      () => null,
    ),

    // The consent travels with the sign-up: the `auth.users` trigger refuses an
    // email account without `consent_version` and `full_name` (Design: D5.2).
    // The result says only whether the member still has to confirm the address;
    // with confirmations on, no session comes back.
    signUp: ({
      email, password, fullName, consentVersion, redirectTo,
    }) => run(
      async (client) => {
        const result = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, consent_version: consentVersion },
            emailRedirectTo: redirectTo,
          },
        });
        return ALREADY_REGISTERED.has(result.error?.code)
          ? { data: { session: null }, error: null }
          : result;
      },
      (data) => ({ confirmationPending: !data?.session }),
    ),

    // supabase-js stores the session itself; the SessionProvider reads it next.
    signInWithPassword: ({ email, password }) => run(
      (client) => client.auth.signInWithPassword({ email, password }),
      () => null,
    ),

    // The call sends the browser to Google, so on success the page is already
    // being left. The PKCE verifier stays in supabase-js's own storage.
    signInWithGoogle: ({ redirectTo }) => run(
      (client) => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }),
      () => null,
    ),

    // Asks for the password reset email. GoTrue answers the same way whether or
    // not the address has an account, so the result says nothing about that.
    // Where the link in the email points is up to the email template; the
    // redirect target only matters to a template that uses it.
    requestPasswordReset: ({ email, redirectTo }) => run(
      (client) => client.auth.resetPasswordForEmail(email, { redirectTo }),
      () => null,
    ),

    // Sends the confirmation email of a sign-up again, for a member whose link
    // expired or never arrived. GoTrue answers the same way for an address with
    // no pending sign-up, so the result says nothing about the account. Like the
    // reset, where the link points is up to the email template. `redirectTo` is
    // optional: the app sends none, and it only matters to a template that uses it.
    resendConfirmation: ({ email, redirectTo }) => run(
      (client) => client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      }),
      () => null,
    ),

    // Sets a new password for the signed-in member (including the one a recovery
    // link has just signed in). The password goes out with the request and never
    // comes back, not even in a failure.
    updatePassword: ({ password }) => run(
      (client) => client.auth.updateUser({ password }),
      () => null,
    ),

    // Verifies the token hash of an email link, which signs the member in. The
    // session stays inside supabase-js; the SessionProvider reads it next. A type
    // outside `LINK_TYPES`, or a blank token, is INVALID without any request.
    verifyEmailLink: async ({ tokenHash, type } = {}) => {
      if (!LINK_TYPES.has(type) || typeof tokenHash !== 'string' || tokenHash.trim() === '') {
        return fail(RESULT_CODES.INVALID);
      }
      return run(
        (client) => client.auth.verifyOtp({ token_hash: tokenHash, type }),
        () => null,
      );
    },

    // Which sign-in providers the backend offers. It is a plain read of the
    // public settings, so it needs no client and no session. A provider counts
    // as offered only when the setting is exactly `true`; no reader, a failed
    // read or an odd answer all leave it out, and only the flag leaves here.
    getProviders: async () => {
      if (!fetchSettings) {
        return fail(RESULT_CODES.UNKNOWN);
      }
      try {
        const settings = await fetchSettings();
        return ok({ google: settings?.external?.google === true });
      } catch (error) {
        return fail(toResultCode(error));
      }
    },
  };
}

export default createAuthAdapter;
