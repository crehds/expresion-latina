/**
 * The only door between the accounts feature and Supabase Auth (Design: D5,
 * D10).
 *
 * `createAuthAdapter(getClient)` takes the lazy client getter and calls it only
 * when a method runs, so creating the adapter never loads supabase-js. Every
 * method resolves to a result (`ok` / `fail`) and never throws: a rejected
 * `getClient()` (a failed dynamic import is a network failure) and any error
 * the client returns are mapped to a result code. A session leaves this module
 * as `{ userId, email }`, never with its tokens.
 */
import { fail, ok, toResultCode } from '../../../shared/backend/resultCodes';

const PROFILE_COLUMNS = 'id, full_name, consent_version, consent_at, is_admin';

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

export function createAuthAdapter(getClient) {
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
  };
}

export default createAuthAdapter;
