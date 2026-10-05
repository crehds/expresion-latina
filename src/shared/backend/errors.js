/**
 * Typed errors of the backend shell (Design: D10, D12).
 *
 * Only the not-configured error lives here. Mapping PostgREST and network
 * failures to the adapter result codes (`FORBIDDEN`, `STARTED`, `OVERLAP`,
 * `NETWORK`, `UNKNOWN`) belongs to the adapters that own those calls
 * (slices 5b, 7 and 8a); it is deliberately not guessed at here.
 */

/**
 * Raised when something asks for the Supabase client while the kill switch is
 * off, that is, while `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`
 * is missing or blank. The message names the variables, never their values.
 */
// eslint-disable-next-line import/prefer-default-export
export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      'The backend is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
    this.name = 'BackendNotConfiguredError';
    this.code = 'BACKEND_NOT_CONFIGURED';
  }
}
