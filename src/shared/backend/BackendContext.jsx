/**
 * Tells the app whether the backend feature is on (Design: D10, D12).
 *
 * `enabled` mirrors the kill switch. `services` is where the feature adapters
 * will be exposed once they exist (slice 5b onward); until then it stays null,
 * and a component rendered without a provider sees the disabled default.
 */
import PropTypes from 'prop-types';
import { createContext, useMemo } from 'react';
import { isBackendConfigured } from './client';

const BackendContext = createContext({ enabled: false, services: null });

export function BackendProvider({ children }) {
  // The kill switch is fixed at build time, so one evaluation per mount is enough.
  const value = useMemo(() => ({ enabled: isBackendConfigured(), services: null }), []);
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

BackendProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default BackendContext;
