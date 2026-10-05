import { BackendNotConfiguredError } from './errors';

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
