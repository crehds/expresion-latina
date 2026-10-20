/**
 * The membership adapter of the running app (Design: D10), for the admin screens.
 *
 * It is `null` wherever there is none: without a provider, while the backend is
 * off, or in a test that supplies other services. A screen that gets `null`
 * renders nothing, the way the account controls do without the auth adapter, so
 * it never makes a request the app did not set up.
 */
import { useContext } from 'react';
import BackendContext from '../../../shared/backend/BackendContext';

export default function useMembership() {
  const { services } = useContext(BackendContext);
  return services?.membership ?? null;
}
