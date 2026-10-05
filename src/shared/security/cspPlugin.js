import { buildCsp } from './csp';

/**
 * Vite plugin that writes the Content-Security-Policy into the built
 * `index.html` as a `<meta>` tag (Design: CSP contract).
 *
 * Build only (`apply: 'build'`): the dev server needs React Refresh's inline
 * preamble, which `script-src 'self'` would block. The production site is
 * what the policy protects.
 *
 * The policy is built when the plugin is created, so a malformed Supabase URL
 * fails the build before anything is emitted. The tag is prepended to `<head>`
 * so the policy is in force before any script or stylesheet is requested.
 *
 * @param {{ supabaseUrl?: string | null }} [options]
 */
export default function cspPlugin({ supabaseUrl } = {}) {
  const policy = buildCsp({ supabaseUrl });

  return {
    name: 'expresion-latina:csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
