/* eslint-disable max-classes-per-file -- the typed errors of the shell live together */
/**
 * Typed errors of the backend shell (Design: D10, D12).
 *
 * Only the failures of the shell itself live here: the kill switch being off,
 * and a plain request of the shell that the backend refused. Mapping PostgREST
 * and network failures to the adapter result codes (`FORBIDDEN`, `STARTED`,
 * `OVERLAP`, `NETWORK`, `UNKNOWN`) belongs to the adapters that own those calls
 * (slices 5b, 7 and 8a); it is deliberately not guessed at here.
 */

/**
 * Raised when something asks for the Supabase client while the kill switch is
 * off, that is, while `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`
 * is missing or blank. The message names the variables, never their values.
 */
export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      'The backend is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
    this.name = 'BackendNotConfiguredError';
    this.code = 'BACKEND_NOT_CONFIGURED';
  }
}

/**
 * Raised when the backend answers a request of the shell with a status that is
 * not a success. It carries the HTTP status so the adapters can map it to a
 * result code, and nothing of the response: the message names the status only,
 * so no body can leak through it.
 */
export class BackendRequestError extends Error {
  constructor(status) {
    super(`The backend answered with HTTP ${status}.`);
    this.name = 'BackendRequestError';
    this.status = status;
  }
}
