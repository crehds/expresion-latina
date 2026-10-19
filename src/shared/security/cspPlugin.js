import { buildCsp } from './csp';

/**
 * Vite plugin that writes the Content-Security-Policy into the built
 * `index.html` as a `<meta>` tag (Design: CSP contract).
 *
 * Build only (`apply: 'build'`): the dev server needs React Refresh's inline
 * preamble, which `script-src 'self'` would block. The production site is
 * what the policy protects.
 *
 * Creating the plugin never throws: `vite.config.js` is also evaluated by the
 * dev server and by Vitest, and a malformed Supabase URL must not stop them.
 * The policy is built in `configResolved`, a build-only hook that runs before
 * bundling, so a malformed URL still fails the build before anything is
 * emitted. The tag is prepended to `<head>` so the policy is in force before
 * any script or stylesheet is requested.
 *
 * @param {{ supabaseUrl?: string | null }} [options]
 */
export default function cspPlugin({ supabaseUrl } = {}) {
  let policy;
  const getPolicy = () => {
    policy ??= buildCsp({ supabaseUrl });
    return policy;
  };

  return {
    name: 'expresion-latina:csp',
    apply: 'build',
    configResolved() {
      getPolicy();
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: getPolicy() },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
