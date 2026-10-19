import { BackendNotConfiguredError, BackendRequestError } from './errors';

describe('BackendRequestError', () => {
  it('is an Error that carries the HTTP status and can be told apart by class and name', () => {
    const error = new BackendRequestError(503);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BackendRequestError);
    expect(error.name).toBe('BackendRequestError');
    expect(error.status).toBe(503);
  });

  it('names the status and nothing else, so no response body can leak through it', () => {
    expect(new BackendRequestError(429).message).toBe('The backend answered with HTTP 429.');
  });
});

describe('BackendNotConfiguredError', () => {
  it('is an Error that can be told apart by class, name and code', () => {
    const error = new BackendNotConfiguredError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BackendNotConfiguredError);
    expect(error.name).toBe('BackendNotConfiguredError');
    expect(error.code).toBe('BACKEND_NOT_CONFIGURED');
  });

  it('explains what is missing without naming any value', () => {
    const { message } = new BackendNotConfiguredError();

    expect(message).toMatch(/VITE_SUPABASE_URL/);
    expect(message).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });
});
