const URL_ENV = 'https://abcd1234.supabase.co';
const KEY_ENV = 'sb_publishable_test_key';

// Each test gets a fresh copy of client.js (and so a fresh singleton) and a
// stand-in for supabase-js, so the real network client is never constructed.
async function loadClient() {
  vi.resetModules();
  const createClient = vi.fn(() => ({ marker: 'client' }));
  const factory = vi.fn(() => ({ createClient }));
  vi.doMock('@supabase/supabase-js', factory);
  const client = await import('./client');
  // Imported after the reset so the class is the one client.js throws.
  const { BackendNotConfiguredError } = await import('./errors');
  return {
    ...client, createClient, factory, BackendNotConfiguredError,
  };
}

function configure(url = URL_ENV, key = KEY_ENV) {
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@supabase/supabase-js');
  vi.resetModules();
});

describe('isBackendConfigured', () => {
  it.each([
    ['both variables are missing', '', ''],
    ['the key is missing', URL_ENV, ''],
    ['the URL is missing', '', KEY_ENV],
    ['the URL is only whitespace', '   ', KEY_ENV],
    ['the key is only whitespace', URL_ENV, ' \t '],
  ])('is false when %s', async (_label, url, key) => {
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
    const { isBackendConfigured } = await loadClient();

    expect(isBackendConfigured()).toBe(false);
  });

  it('is true only when both variables are non-blank', async () => {
    configure();
    const { isBackendConfigured } = await loadClient();

    expect(isBackendConfigured()).toBe(true);
  });

  it('reads the environment at call time', async () => {
    const { isBackendConfigured } = await loadClient();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    expect(isBackendConfigured()).toBe(false);

    configure();
    expect(isBackendConfigured()).toBe(true);
  });
});

describe('supabaseStorageKey', () => {
  it('uses the first label of the Supabase host', async () => {
    const { supabaseStorageKey } = await loadClient();

    expect(supabaseStorageKey('https://abcd1234.supabase.co')).toBe('sb-abcd1234-auth-token');
    expect(supabaseStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });

  it('throws on a malformed URL', async () => {
    const { supabaseStorageKey } = await loadClient();

    expect(() => supabaseStorageKey('not a url')).toThrow();
    expect(() => supabaseStorageKey('')).toThrow();
  });
});

describe('getSupabaseClient', () => {
  it('never loads supabase-js at import time', async () => {
    configure();
    const { factory } = await loadClient();

    expect(factory).not.toHaveBeenCalled();
  });

  it('fails closed without loading supabase-js when the backend is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const {
      getSupabaseClient, factory, createClient, BackendNotConfiguredError,
    } = await loadClient();

    await expect(getSupabaseClient()).rejects.toBeInstanceOf(BackendNotConfiguredError);
    expect(factory).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates the client from the URL and the publishable key', async () => {
    configure();
    const { getSupabaseClient, createClient } = await loadClient();

    const client = await getSupabaseClient();

    expect(client).toEqual({ marker: 'client' });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(URL_ENV, KEY_ENV, {
      auth: { storageKey: 'sb-abcd1234-auth-token' },
    });
  });

  it('derives the storage key from the Supabase URL, never from the site location', async () => {
    configure('https://projectref.supabase.co');
    const hostname = vi.spyOn(window, 'location', 'get').mockReturnValue({
      hostname: 'www.expresionlatina.example',
      host: 'www.expresionlatina.example',
      href: 'https://www.expresionlatina.example/schedules',
      origin: 'https://www.expresionlatina.example',
    });
    const { getSupabaseClient, createClient } = await loadClient();

    await getSupabaseClient();
    hostname.mockRestore();

    const [, , options] = createClient.mock.calls[0];
    expect(options.auth.storageKey).toBe('sb-projectref-auth-token');
    expect(options.auth.storageKey).not.toMatch(/www|expresionlatina/);
  });

  it('reuses one instance across calls', async () => {
    configure();
    const { getSupabaseClient, createClient } = await loadClient();

    const first = await getSupabaseClient();
    const second = await getSupabaseClient();

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('creates one client when two calls overlap before the first resolves', async () => {
    configure();
    const { getSupabaseClient, createClient } = await loadClient();

    const [first, second] = await Promise.all([getSupabaseClient(), getSupabaseClient()]);

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('rejects on a malformed URL without creating a client', async () => {
    configure('not a url');
    const { getSupabaseClient, createClient } = await loadClient();

    await expect(getSupabaseClient()).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not cache a failure: a later call can succeed once configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const { getSupabaseClient, createClient, BackendNotConfiguredError } = await loadClient();
    await expect(getSupabaseClient()).rejects.toBeInstanceOf(BackendNotConfiguredError);

    configure();

    await expect(getSupabaseClient()).resolves.toEqual({ marker: 'client' });
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
