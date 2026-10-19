import createServices from './createServices';

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
});
