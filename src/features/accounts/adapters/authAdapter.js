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
 * as `{ userId, email }`, never with its tokens, and the sign-in methods return
 * nothing at all (the session stays inside supabase-js).
 */
import {
  RESULT_CODES, fail, ok, toResultCode,
} from '../../../shared/backend/resultCodes';

const PROFILE_COLUMNS = 'id, full_name, consent_version, consent_at, is_admin';

// Depending on its settings, Supabase answers a sign-up for a registered address
// with an obfuscated success or with one of these errors. Both end as "check
// your email", so the form cannot be used to find out who has an account.
const ALREADY_REGISTERED = new Set(['user_already_exists', 'email_exists']);

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
  async function run(call, read) {
    try {
      const client = await getClient();
      const { data, error } = await call(client);
      return error ? fail(toResultCode(error)) : ok(read(data));
    } catch (error) {
      return fail(toResultCode(error));
    }
  }

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

    signOut: () => run(
      async (client) => ({ data: null, ...(await client.auth.signOut()) }),
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
