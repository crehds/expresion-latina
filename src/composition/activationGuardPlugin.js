/**
 * Vite plugin that stops a production build from going live with the privacy
 * notice still unfilled.
 *
 * The notice names who answers for the members' data with two placeholders in
 * brackets (`privacyContacts.js`). Until the owner replaces them the feature
 * must not reach members, but the code cannot tell a finished notice from an
 * unfinished one, so the build does: it FAILS when ALL of these hold.
 *
 * 1. It is a Vercel production deployment (`VERCEL_ENV === 'production'`,
 *    which Vercel sets at build time).
 * 2. The backend is configured (a Supabase URL and a publishable key, neither
 *    blank): the account pages exist in this build.
 * 3. A value is still unfilled: a bracketed placeholder, empty, only
 *    whitespace, or not text at all.
 *
 * Any other build is untouched: a local build, a preview deployment, the e2e
 * builds and any build with the backend off, which has no account pages.
 *
 * Like the CSP plugin it applies to the build only and creating it never throws
 * (`vite.config.js` is also read by the dev server and by Vitest). The check
 * runs in `configResolved`, before anything is bundled. It lives in the
 * composition root because it names a feature file; the values arrive as
 * options, so the plugin itself imports nothing from the features.
 */

const PRODUCTION = 'production';

const isBlank = (value) => typeof value !== 'string' || value.trim() === '';

// A value that is not text, is empty or only whitespace, or is still a bracketed
// placeholder counts as unfilled, never as filled in.
const isPlaceholder = (value) => isBlank(value) || /^\s*\[.*\]\s*$/.test(value);

/** The names of the values that are still unfilled (see above), in order. */
export function findPlaceholders(values = {}) {
  return Object.entries(values)
    .filter(([, value]) => isPlaceholder(value))
    .map(([name]) => name);
}

/** Whether this build is the one that makes the feature reachable for members. */
export function isProductionActivation({ vercelEnv, supabaseUrl, supabaseKey } = {}) {
  return vercelEnv === PRODUCTION && !isBlank(supabaseUrl) && !isBlank(supabaseKey);
}

/**
 * @param {{
 *   vercelEnv?: string, supabaseUrl?: string, supabaseKey?: string,
 *   values?: Record<string, string>, file?: string,
 * }} [options] `values` are the notice values to check; `file` is the path the
 *   message tells the owner to edit.
 */
export default function activationGuardPlugin({
  vercelEnv, supabaseUrl, supabaseKey, values = {}, file = '',
} = {}) {
  return {
    name: 'expresion-latina:activation-guard',
    apply: 'build',
    configResolved() {
      if (!isProductionActivation({ vercelEnv, supabaseUrl, supabaseKey })) {
        return;
      }
      const left = findPlaceholders(values);
      if (left.length > 0) {
        throw new Error(
          'This production build has the backend configured, but the privacy notice still has '
          + `unfilled values (placeholders in brackets or blanks): ${left.join(', ')}. `
          + `Replace them in ${file} with the real data controller and contact (see the `
          + 'activation steps in supabase/README.md), then deploy again.',
        );
      }
    },
  };
}
