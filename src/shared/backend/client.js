/**
 * Lazy Supabase client and the kill switch (Design: D10, D12).
 *
 * The site works without a backend. The feature is on only when both build-time
 * variables are present, so removing them and redeploying turns it off. Nothing
 * here runs at import time: `@supabase/supabase-js` is loaded by a dynamic
 * `import()` inside `getSupabaseClient`, so a visitor of a build with the
 * feature off (or one who never touches an account page) never downloads it.
 *
 * The variables are read at call time, not captured in a constant, so tests can
 * change them with `vi.stubEnv`.
 */
import { BackendNotConfiguredError, BackendRequestError } from './errors';

// How long the public Auth settings request may take before it is aborted.
const AUTH_SETTINGS_TIMEOUT_MS = 5000;

const isFilled = (value) => typeof value === 'string' && value.trim() !== '';

function readConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return isFilled(url) && isFilled(key) ? { url: url.trim(), key: key.trim() } : null;
}

/**
 * Kill switch: true only when both the Supabase URL and the publishable key are
 * non-blank.
 */
export function isBackendConfigured() {
  return readConfig() !== null;
}

/**
 * The localStorage key under which supabase-js keeps the session:
 * `sb-<first label of the Supabase host>-auth-token`. This is supabase-js's own
 * default, passed explicitly so a "is there a stored session?" check and the
 * client can never disagree. It derives from the Supabase URL only, never from
 * the site's own location. Throws on a URL that cannot be parsed.
 */
export function supabaseStorageKey(supabaseUrl) {
  const { hostname } = new URL(supabaseUrl);
  const label = hostname.split('.')[0];
  if (!label) {
    throw new TypeError('The Supabase URL has no host to derive a storage key from.');
  }
  return `sb-${label}-auth-token`;
}

/**
 * Whether localStorage already holds a supabase-js session for this backend.
 * The app loads supabase-js eagerly only when this is true. False while the
 * kill switch is off, and false on any failure (a blocked storage, an
 * unparsable URL): "nothing stored" is the safe answer, since it only means
 * supabase-js is loaded later, on demand.
 */
export function hasStoredSession() {
  const config = readConfig();
  if (!config) {
    return false;
  }
  try {
    return window.localStorage.getItem(supabaseStorageKey(config.url)) !== null;
  } catch {
    return false;
  }
}

let pending = null;

async function createSupabaseClient() {
  const config = readConfig();
  if (!config) {
    throw new BackendNotConfiguredError();
  }
  // PKCE (Design: D10): auth-js defaults to the implicit flow, which would put
  // the session tokens in the callback URL. With `detectSessionInUrl` the client
  // itself exchanges the `?code=` of a callback while it initializes, and
  // `getSession()` waits for that. The app never calls `exchangeCodeForSession`:
  // a second exchange would race the first and burn the single-use verifier.
  const auth = {
    storageKey: supabaseStorageKey(config.url),
    flowType: 'pkce',
    detectSessionInUrl: true,
  };
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(config.url, config.key, { auth });
}

/**
 * Resolves to the one shared Supabase client, creating it on first use.
 * Concurrent first calls share the same pending promise, so only one client is
 * ever created. Rejects with `BackendNotConfiguredError` (without loading
 * supabase-js) while the kill switch is off. A failure is not cached: the next
 * call tries again.
 */
export function getSupabaseClient() {
  if (!pending) {
    pending = createSupabaseClient().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/**
 * The public Auth settings of the backend (`GET /auth/v1/settings`), which say
 * which sign-in providers are enabled (`external.google`). auth-js has no
 * public method for them, and the answer needs no session and no client, so
 * this is one plain request: it never loads supabase-js. The publishable key is
 * the only credential it sends.
 *
 * It fails closed. It rejects, without a request, while the kill switch is off
 * or the URL cannot be parsed; it rejects with `BackendRequestError` on a status
 * that is not a success, and with whatever `fetch` or `json()` raised
 * otherwise. A backend that does not answer within `AUTH_SETTINGS_TIMEOUT_MS`
 * is given up on: the request is aborted and this rejects with the `AbortError`
 * of the abort. A caller that shows something only when the settings say so
 * shows nothing in every one of those cases.
 */
export async function fetchAuthSettings() {
  const config = readConfig();
  if (!config) {
    throw new BackendNotConfiguredError();
  }
  const endpoint = new URL(`${config.url.replace(/\/+$/, '')}/auth/v1/settings`);
  // Without a limit, a request that hangs would hold the caller back for as
  // long as the browser lets it. The timer runs until the body is read too, and
  // it is cleared whichever way this ends.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_SETTINGS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: config.key },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BackendRequestError(response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
