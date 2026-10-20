// The account page with the real SessionProvider: what the member finds when the
// session ended in an error that the first load did not produce (a sign-out that
// failed, a profile that could not be read after a change of user). The unit
// tests of Account fake the whole session; this one fakes only the auth adapter,
// so the page meets the provider's own idea of what has already been loaded.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Link, MemoryRouter, Route, Routes,
} from 'react-router-dom';

import { SessionProvider } from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import { hasStoredSession } from '../../shared/backend/client';
import Account from './Account';

vi.mock('../../shared/backend/client', async (importOriginal) => ({
  ...(await importOriginal()),
  hasStoredSession: vi.fn(),
}));

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const OTHER_SESSION = { userId: 'user-2', email: 'luis@example.test' };
const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// `emit` plays a supabase-js auth event to the subscriber.
function fakeAuth(overrides = {}) {
  const auth = {
    emit: null,
    getSession: vi.fn(async () => ok(SESSION)),
    subscribe: vi.fn(async (callback) => {
      auth.emit = callback;
      return ok(vi.fn());
    }),
    getOwnProfile: vi.fn(async () => ok(PROFILE)),
    signOut: vi.fn(async () => ok()),
    ...overrides,
  };
  return auth;
}

function Home() {
  return (
    <>
      <p>home page</p>
      <Link to="/account">back to the account</Link>
    </>
  );
}

function renderAccount(auth) {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider>
          <Routes>
            <Route path="/account" element={<Account />} />
            <Route path="/login" element={<p>login page</p>} />
            <Route path="/" element={<Home />} />
          </Routes>
        </SessionProvider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

const account = () => screen.findByRole('heading', { level: 1, name: 'Mi cuenta' });

describe('Account with the real session provider', () => {
  beforeEach(() => {
    hasStoredSession.mockReset();
    hasStoredSession.mockReturnValue(false);
  });

  it('loads the account again when the member comes back after a sign-out that failed', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({ signOut: vi.fn().mockResolvedValueOnce(fail('NETWORK')) });
    renderAccount(auth);
    await account();
    await screen.findByText('ana@example.test');

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await user.click(await screen.findByRole('link', { name: 'back to the account' }));

    expect(await screen.findByText('ana@example.test')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });

  it('shows the account again when "Reintentar" is pressed after a profile that could not be read', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    renderAccount(auth);
    await screen.findByText('ana@example.test');
    // Another user signs in elsewhere, and this page cannot read their profile.
    auth.getSession.mockResolvedValue(ok(OTHER_SESSION));
    auth.getOwnProfile
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockResolvedValue(ok({ ...PROFILE, id: 'user-2', fullName: 'Luis Soto' }));
    act(() => { auth.emit(OTHER_SESSION); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta. Inténtalo de nuevo.');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText('luis@example.test')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });
});
