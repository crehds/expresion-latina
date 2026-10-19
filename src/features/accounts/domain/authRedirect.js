/**
 * Where Supabase Auth sends the browser back to (Design: D5, D10).
 *
 * The sign-up confirmation link and the Google flow both return to
 * `/auth/callback` on the origin the flow started on: the PKCE code verifier
 * is kept in that origin's localStorage, so a callback on another origin could
 * not use it. The address must also be on the redirect allowlist of the
 * project (`additional_redirect_urls` in `supabase/config.toml`, the dashboard
 * on a hosted one); a test ties the path to the local list.
 */
export const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * The page the links of the confirmation and recovery emails open. The email
 * templates (`supabase/templates`) build `{{ .SiteURL }}` + this path with the
 * token hash, so they never go through the redirect allowlist; a test ties the
 * templates to this path.
 */
export const AUTH_CONFIRM_PATH = '/auth/confirm';

export const authCallbackUrl = () => `${window.location.origin}${AUTH_CALLBACK_PATH}`;
