import { DEFAULT_ALERT_DAYS, parseAlertDays } from '../domain/keepaliveAlert';

/**
 * Vite plugin that stops a build whose keep-alive banner threshold is malformed.
 *
 * `VITE_KEEPALIVE_ALERT_DAYS` is read when the site is built and written into
 * the bundle, so a typo would otherwise ship without a word: the banner would
 * fall back to the default, or not appear when it was meant to. The build refuses
 * it instead, whether the backend is on or off, since the variable is all it
 * reads. The accepted forms are the ones `parseAlertDays` knows; the message
 * names them and quotes the value, which is no secret.
 *
 * Like the CSP plugin it applies to the build only, and creating it never throws:
 * `vite.config.js` is also evaluated by the dev server and by Vitest, which never
 * refuse a value (the banner counts a malformed one as the default there). The
 * check runs in `configResolved`, a build-only hook that runs before bundling, so
 * a malformed value fails the build before anything is emitted.
 *
 * @param {{ value?: string }} [options] `value` is the variable as `loadEnv`
 *   read it: the process environment first, then the env files.
 */
export default function keepaliveAlertPlugin({ value } = {}) {
  return {
    name: 'expresion-latina:keepalive-alert-days',
    apply: 'build',
    configResolved() {
      if (parseAlertDays(value).kind === 'malformed') {
        throw new Error(
          `VITE_KEEPALIVE_ALERT_DAYS is malformed: ${JSON.stringify(value)}. `
          + 'Use a whole number of days of at least 1, in digits only (for example 3 or 7), '
          + 'or "off" to turn the keep-alive banner off. '
          + `Leave it unset for the default of ${DEFAULT_ALERT_DAYS} days.`,
        );
      }
    },
  };
}
