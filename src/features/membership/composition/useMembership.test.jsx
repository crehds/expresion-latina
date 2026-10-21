import { renderHook } from '@testing-library/react';
import PropTypes from 'prop-types';

import BackendContext from '../../../shared/backend/BackendContext';
import useMembership from './useMembership';

function providerFor(value) {
  function Provider({ children }) {
    return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
  }
  Provider.propTypes = { children: PropTypes.node.isRequired };
  return Provider;
}

describe('useMembership', () => {
  it('returns the membership adapter the services carry', () => {
    const membership = { searchMembers: vi.fn() };

    const { result } = renderHook(() => useMembership(), {
      wrapper: providerFor({ enabled: true, services: { auth: {}, membership } }),
    });

    expect(result.current).toBe(membership);
  });

  it('returns null without a provider, where the backend is off by default', () => {
    const { result } = renderHook(() => useMembership());

    expect(result.current).toBeNull();
  });

  it('returns null while the backend is disabled and there are no services', () => {
    const { result } = renderHook(() => useMembership(), {
      wrapper: providerFor({ enabled: false, services: null }),
    });

    expect(result.current).toBeNull();
  });

  it('returns null when the services carry no membership adapter', () => {
    const { result } = renderHook(() => useMembership(), {
      wrapper: providerFor({ enabled: true, services: { auth: {} } }),
    });

    expect(result.current).toBeNull();
  });
});
