import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_CALLBACK_PATH, authCallbackUrl } from './authRedirect';

const CONFIG = path.resolve(__dirname, '../../../../supabase/config.toml');

describe('authCallbackUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('points at /auth/callback on the origin the app is served from', () => {
    expect(AUTH_CALLBACK_PATH).toBe('/auth/callback');
    expect(authCallbackUrl()).toBe(`${window.location.origin}/auth/callback`);
  });

  it('follows the origin the flow started on, whichever it is', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ origin: 'https://www.example.test' });

    expect(authCallbackUrl()).toBe('https://www.example.test/auth/callback');
  });

  it('is on the local redirect allowlist of supabase/config.toml', () => {
    const config = readFileSync(CONFIG, 'utf8');

    expect(config).toContain(`"http://localhost:3000${AUTH_CALLBACK_PATH}"`);
  });
});
