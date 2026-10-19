import { fetchAuthSettings } from '../shared/backend/client';
import createServices from './createServices';

// The real reader would call the network; the wiring is what this file checks.
vi.mock('../shared/backend/client', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAuthSettings: vi.fn(async () => ({ external: { google: true } })),
}));

describe('createServices', () => {
  it('builds the auth adapter from the lazy client getter', () => {
    const getClient = vi.fn();

    const services = createServices(getClient);

    expect(Object.keys(services)).toEqual(['auth']);
    expect(typeof services.auth.getSession).toBe('function');
    expect(typeof services.auth.signOut).toBe('function');
  });

  it('does not load the client while building the services', () => {
    const getClient = vi.fn();

    createServices(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  it('hands the getter to the adapter, which calls it when a method runs', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }) } };
    const getClient = vi.fn(async () => client);

    const result = await createServices(getClient).auth.getSession();

    expect(getClient).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, data: null });
  });

  it('hands the adapter the shared settings reader, so it can tell which providers are on', async () => {
    const getClient = vi.fn();

    const result = await createServices(getClient).auth.getProviders();

    expect(fetchAuthSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, data: { google: true } });
    expect(getClient).not.toHaveBeenCalled();
  });
});
