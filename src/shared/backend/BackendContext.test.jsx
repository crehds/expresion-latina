import { render, screen } from '@testing-library/react';
import { useContext } from 'react';
import BackendContext, { BackendProvider } from './BackendContext';
import { getSupabaseClient } from './client';

function Probe() {
  const value = useContext(BackendContext);
  return <output data-testid="value">{JSON.stringify(value)}</output>;
}

const read = () => JSON.parse(screen.getByTestId('value').textContent);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('BackendContext', () => {
  it('defaults to a disabled backend with no services', () => {
    render(<Probe />);

    expect(read()).toEqual({ enabled: false, services: null });
  });
});

describe('BackendProvider', () => {
  it('is disabled when the environment is not configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    render(<BackendProvider><Probe /></BackendProvider>);

    expect(read()).toEqual({ enabled: false, services: null });
  });

  it('stays disabled when only one variable is set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd1234.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    render(<BackendProvider><Probe /></BackendProvider>);

    expect(read().enabled).toBe(false);
  });

  it('is enabled only with both variables, and still has no services in this slice', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd1234.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');

    render(<BackendProvider><Probe /></BackendProvider>);

    expect(read()).toEqual({ enabled: true, services: null });
  });

  describe('createServices', () => {
    const enable = () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd1234.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    };

    it('builds the services from the lazy client getter when the backend is enabled', () => {
      enable();
      const createServices = vi.fn(() => ({ marker: 'services' }));

      render(<BackendProvider createServices={createServices}><Probe /></BackendProvider>);

      expect(createServices).toHaveBeenCalledWith(getSupabaseClient);
      expect(read()).toEqual({ enabled: true, services: { marker: 'services' } });
    });

    it('builds the services once per mount, not on every render', () => {
      enable();
      const createServices = vi.fn(() => ({ marker: 'services' }));

      const { rerender } = render(
        <BackendProvider createServices={createServices}><Probe /></BackendProvider>,
      );
      rerender(<BackendProvider createServices={createServices}><Probe /></BackendProvider>);

      expect(createServices).toHaveBeenCalledTimes(1);
    });

    it('is never called while the backend is disabled', () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
      const createServices = vi.fn(() => ({ marker: 'services' }));

      render(<BackendProvider createServices={createServices}><Probe /></BackendProvider>);

      expect(createServices).not.toHaveBeenCalled();
      expect(read()).toEqual({ enabled: false, services: null });
    });
  });
});
