/**
 * Composition root of the backend services (Design: D10).
 *
 * `src/shared/**` may not import from `src/features/**`, so the shared
 * `BackendProvider` receives this function as a prop instead of knowing the
 * adapters. It gets the lazy client getter and returns the adapters; none of
 * them loads supabase-js until a method runs. What an adapter needs besides the
 * client, such as the reader of the backend's public Auth settings, is wired in
 * here too, so the adapters stay free of the build configuration.
 */
import { createAuthAdapter } from '../features/accounts/adapters/authAdapter';
import { createMembershipAdapter } from '../features/membership/adapters/membershipAdapter';
import { fetchAuthSettings } from '../shared/backend/client';

export default function createServices(getClient) {
  return {
    auth: createAuthAdapter(getClient, { fetchSettings: fetchAuthSettings }),
    membership: createMembershipAdapter(getClient),
  };
}
