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
  // Imported after the reset so the classes are the ones client.js throws.
  const { BackendNotConfiguredError, BackendRequestError } = await import('./errors');
  return {
    ...client, createClient, factory, BackendNotConfiguredError, BackendRequestError,
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

describe('hasStoredSession', () => {
  const STORAGE_KEY = 'sb-abcd1234-auth-token';

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('is false when the backend is not configured, even with a stored session', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    window.localStorage.setItem(STORAGE_KEY, '{}');
    const { hasStoredSession } = await loadClient();

    expect(hasStoredSession()).toBe(false);
  });

  it('is false when nothing is stored under the key', async () => {
    configure();
    window.localStorage.setItem('sb-other-auth-token', '{}');
    const { hasStoredSession } = await loadClient();

    expect(hasStoredSession()).toBe(false);
  });

  it('is true when localStorage holds the key derived from the Supabase URL', async () => {
    configure();
    window.localStorage.setItem(STORAGE_KEY, '{}');
    const { hasStoredSession } = await loadClient();

    expect(hasStoredSession()).toBe(true);
  });

  it('is false when reading the storage throws', async () => {
    configure();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });
    const { hasStoredSession } = await loadClient();

    expect(hasStoredSession()).toBe(false);
  });

  it('is false on a malformed URL instead of throwing', async () => {
    configure('not a url');
    const { hasStoredSession } = await loadClient();

    expect(hasStoredSession()).toBe(false);
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

  it('creates the client from the URL and the publishable key, with the PKCE flow', async () => {
    configure();
    const { getSupabaseClient, createClient } = await loadClient();

    const client = await getSupabaseClient();

    expect(client).toEqual({ marker: 'client' });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(URL_ENV, KEY_ENV, {
      auth: {
        storageKey: 'sb-abcd1234-auth-token',
        flowType: 'pkce',
        detectSessionInUrl: true,
      },
    });
  });

  it('derives the storage key from the Supabase URL, never from the site location', async () => {
    configure('https://projectref.supabase.co');
    const location = vi.spyOn(window, 'location', 'get').mockReturnValue({
      hostname: 'www.expresionlatina.example',
      host: 'www.expresionlatina.example',
      href: 'https://www.expresionlatina.example/schedules',
      origin: 'https://www.expresionlatina.example',
    });
    const { getSupabaseClient, createClient } = await loadClient();

    try {
      await getSupabaseClient();
    } finally {
      location.mockRestore();
    }

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

describe('fetchAuthSettings', () => {
  const SETTINGS = { external: { google: true }, disable_signup: false };

  const answer = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  // Stands in for the global fetch; every call is recorded.
  function stubFetch(response) {
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads GET /auth/v1/settings with the publishable key and resolves to the settings', async () => {
    configure();
    const fetchMock = stubFetch(answer(SETTINGS));
    const { fetchAuthSettings } = await loadClient();

    await expect(fetchAuthSettings()).resolves.toEqual(SETTINGS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://abcd1234.supabase.co/auth/v1/settings');
    expect(init.headers).toEqual({ apikey: KEY_ENV });
  });

  it('ignores a trailing slash of the configured URL', async () => {
    configure('http://127.0.0.1:54321/');
    const fetchMock = stubFetch(answer(SETTINGS));
    const { fetchAuthSettings } = await loadClient();

    await fetchAuthSettings();

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:54321/auth/v1/settings');
  });

  it('never loads supabase-js', async () => {
    configure();
    stubFetch(answer(SETTINGS));
    const { fetchAuthSettings, factory } = await loadClient();

    await fetchAuthSettings();

    expect(factory).not.toHaveBeenCalled();
  });

  it('reads the environment at call time', async () => {
    const fetchMock = stubFetch(answer(SETTINGS));
    const { fetchAuthSettings } = await loadClient();
    configure();

    await fetchAuthSettings();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed without a request while the backend is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    const fetchMock = stubFetch(answer(SETTINGS));
    const { fetchAuthSettings, BackendNotConfiguredError } = await loadClient();

    await expect(fetchAuthSettings()).rejects.toBeInstanceOf(BackendNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects on a malformed URL without a request', async () => {
    configure('not a url');
    const fetchMock = stubFetch(answer(SETTINGS));
    const { fetchAuthSettings } = await loadClient();

    await expect(fetchAuthSettings()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 404, 429, 500, 503])(
    'rejects with the HTTP status, and nothing of the body, when the backend answers %i',
    async (status) => {
      configure();
      stubFetch(answer({ message: 'private detail' }, status));
      const { fetchAuthSettings, BackendRequestError } = await loadClient();

      const error = await fetchAuthSettings().catch((caught) => caught);

      expect(error).toBeInstanceOf(BackendRequestError);
      expect(error.status).toBe(status);
      expect(error.message).not.toMatch(/private detail/);
    },
  );

  it('rejects when the answer is not JSON', async () => {
    configure();
    stubFetch({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    });
    const { fetchAuthSettings } = await loadClient();

    await expect(fetchAuthSettings()).rejects.toBeInstanceOf(SyntaxError);
  });

  it('rejects with the network error when the request itself fails', async () => {
    configure();
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn(async () => { throw failure; }));
    const { fetchAuthSettings } = await loadClient();

    await expect(fetchAuthSettings()).rejects.toBe(failure);
  });

  describe('when the backend does not answer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Runs fetchAuthSettings and records whether it has settled, so a test can
    // tell "still waiting" from "gave up" at an exact moment.
    async function startRequest() {
      const { fetchAuthSettings } = await loadClient();
      const request = { settled: false };
      request.outcome = fetchAuthSettings()
        .catch((error) => error)
        .finally(() => { request.settled = true; });
      return request;
    }

    // Something that stays open until the signal aborts it, like a hung request.
    const hangsUntilAborted = (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });

    it('hands the request an abort signal that nothing has fired yet', async () => {
      configure();
      const fetchMock = stubFetch(answer(SETTINGS));
      const { fetchAuthSettings } = await loadClient();

      await fetchAuthSettings();

      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal.aborted).toBe(false);
    });

    it('aborts a request that has not answered after 5 seconds', async () => {
      configure();
      vi.stubGlobal('fetch', vi.fn((_url, { signal }) => hangsUntilAborted(signal)));
      const request = await startRequest();

      await vi.advanceTimersByTimeAsync(4999);
      expect(request.settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const error = await request.outcome;
      expect(request.settled).toBe(true);
      expect(error.name).toBe('AbortError');
    });

    it('also gives up on an answer whose body never arrives', async () => {
      configure();
      vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({
        ok: true,
        status: 200,
        json: () => hangsUntilAborted(signal),
      })));
      const request = await startRequest();

      await vi.advanceTimersByTimeAsync(5000);

      const error = await request.outcome;
      expect(error.name).toBe('AbortError');
    });

    it('leaves no timer running once the backend has answered', async () => {
      configure();
      stubFetch(answer(SETTINGS));
      const { fetchAuthSettings } = await loadClient();

      await fetchAuthSettings();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('leaves no timer running when the backend refuses or the request fails', async () => {
      configure();
      const { fetchAuthSettings } = await loadClient();

      stubFetch(answer({}, 503));
      await fetchAuthSettings().catch(() => {});
      expect(vi.getTimerCount()).toBe(0);

      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
      await fetchAuthSettings().catch(() => {});
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
