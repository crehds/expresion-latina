/**
 * Content-Security-Policy builder (Design: CSP contract).
 *
 * A pure function: the policy depends only on the Supabase URL passed in,
 * never on `import.meta.env` or the clock. A build-only Vite
 * `transformIndexHtml` plugin calls it and writes the result into a `<meta>`
 * tag.
 *
 * The origins listed are the ones the site uses today: Google Fonts (the
 * stylesheet import in `src/styles/typography.css`, the font files from
 * fonts.gstatic.com) and the Google Maps embed on the Contact page. Google
 * OAuth is a top-level navigation, so it needs no entry. `script-src` stays
 * `'self'` and never gains `'unsafe-inline'`.
 */

const HTTP_PROTOCOLS = ['http:', 'https:'];

/**
 * Reduces a configured Supabase URL to its origin (scheme + host + port; no
 * path, query or credentials). Returns `null` when nothing is configured and
 * throws on a malformed URL or a scheme other than http(s): a typo in the
 * deployment environment should fail the build, not ship a policy that
 * silently blocks every backend call.
 */
function connectOrigin(supabaseUrl) {
  if (supabaseUrl === undefined || supabaseUrl === null) return null;
  if (typeof supabaseUrl !== 'string') {
    throw new TypeError('supabaseUrl must be a string');
  }
  const trimmed = supabaseUrl.trim();
  if (trimmed === '') return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid Supabase URL: ${JSON.stringify(trimmed)}`);
  }
  if (!HTTP_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Supabase URL must use http or https: ${JSON.stringify(trimmed)}`);
  }
  return url.origin;
}

/**
 * @param {{ supabaseUrl?: string | null }} [options]
 * @returns {string} the policy, directives joined by `'; '`, no trailing `;`
 */
// eslint-disable-next-line import/prefer-default-export
export function buildCsp({ supabaseUrl } = {}) {
  const origin = connectOrigin(supabaseUrl);
  const connectSrc = origin ? `connect-src 'self' ${origin}` : "connect-src 'self'";

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    'frame-src https://www.google.com',
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
