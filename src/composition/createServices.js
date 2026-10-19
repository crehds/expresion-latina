/**
 * Composition root of the backend services (Design: D10).
 *
 * `src/shared/**` may not import from `src/features/**`, so the shared
 * `BackendProvider` receives this function as a prop instead of knowing the
 * adapters. It gets the lazy client getter and returns the adapters; none of
 * them loads supabase-js until a method runs.
 */
import { createAuthAdapter } from '../features/accounts/adapters/authAdapter';

export default function createServices(getClient) {
  return { auth: createAuthAdapter(getClient) };
}
