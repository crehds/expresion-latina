import { render, screen } from '@testing-library/react';
import { useContext } from 'react';
import BackendContext, { BackendProvider } from './BackendContext';

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
});
