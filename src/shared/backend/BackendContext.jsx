/**
 * Tells the app whether the backend feature is on (Design: D10, D12).
 *
 * `enabled` mirrors the kill switch. `services` is where the feature adapters
 * are exposed. This shared module must not import from `src/features/**`, so
 * the composition root passes `createServices`, which receives the lazy client
 * getter and returns the adapters. It runs once per mount, and only while the
 * backend is enabled; otherwise `services` stays null. A component rendered
 * without a provider sees the disabled default.
 */
import PropTypes from 'prop-types';
import { createContext, useMemo } from 'react';
import { getSupabaseClient, isBackendConfigured } from './client';

const BackendContext = createContext({ enabled: false, services: null });

const noServices = () => null;

export function BackendProvider({ children, createServices = noServices }) {
  // The kill switch is fixed at build time, and the services belong to the mount,
  // so one evaluation per mount is enough.
  const value = useMemo(() => {
    const enabled = isBackendConfigured();
    return { enabled, services: enabled ? createServices(getSupabaseClient) : null };
  }, []);
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

BackendProvider.propTypes = {
  children: PropTypes.node.isRequired,
  createServices: PropTypes.func,
};

export default BackendContext;
