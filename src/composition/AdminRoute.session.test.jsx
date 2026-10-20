// The admin guard with the real SessionProvider: what "Reintentar" does after the
// session ended in an error that the first load did not produce (a profile read
// that failed after the load), and what a sign-out that fails leaves behind. The
// unit tests of AdminRoute fake the whole session; this one fakes only the auth
// adapter, so the retry meets the provider's own idea of what has already been
// loaded.
import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SessionProvider, useSession } from '../features/accounts/composition/SessionProvider';
import BackendContext from '../shared/backend/BackendContext';
import { hasStoredSession } from '../shared/backend/client';
import AdminRoute from './AdminRoute';

vi.mock('../shared/backend/client', async (importOriginal) => ({
  ...(await importOriginal()),
  hasStoredSession: vi.fn(),
}));

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const ADMIN = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: true,
};

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// The profile reads in order: the load's own works, the next one (a refresh) fails,
// and the rest work.
const profileFailsOnce = () => vi.fn()
  .mockResolvedValueOnce(ok(ADMIN))
  .mockResolvedValueOnce(fail('NETWORK'))
  .mockResolvedValue(ok(ADMIN));

function fakeAuth(overrides = {}) {
  return {
    getSession: vi.fn(async () => ok(SESSION)),
    subscribe: vi.fn(async () => ok(vi.fn())),
    getOwnProfile: vi.fn(async () => ok(ADMIN)),
    signOut: vi.fn(async () => ok()),
    ...overrides,
  };
}

// The protected page, with the two things the session can do there that matter
// here: read the profile again, and sign out.
function AdminArea() {
  const { refresh, signOut } = useSession();
  return (
    <>
      <h1>admin area</h1>
      <button type="button" onClick={refresh}>refresh</button>
      <button type="button" onClick={signOut}>sign out</button>
    </>
  );
}

function renderGuard(auth) {
  render(
    <MemoryRouter initialEntries={['/admin/members']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/admin/members" element={<AdminRoute><AdminArea /></AdminRoute>} />
              <Route path="/login" element={<p>login page</p>} />
            </Routes>
          </Suspense>
        </SessionProvider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

const area = () => screen.findByRole('heading', { level: 1, name: 'admin area' });

async function failARefresh(user) {
  await user.click(await screen.findByRole('button', { name: 'refresh' }));
  return screen.findByRole('alert');
}

describe('AdminRoute with the real session provider', () => {
  beforeEach(() => {
    hasStoredSession.mockReset();
    hasStoredSession.mockReturnValue(false);
  });

  it('shows the area again when "Reintentar" is pressed after a profile read that failed', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({ getOwnProfile: profileFailsOnce() });
    renderGuard(auth);
    await area();

    const alert = await failARefresh(user);
    expect(alert).toHaveTextContent('No pudimos comprobar tu acceso. Inténtalo de nuevo.');
    expect(screen.queryByRole('heading', { name: 'admin area' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await area()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    // The load's own read, the one that failed, and the one of the new load.
    expect(auth.getOwnProfile).toHaveBeenCalledTimes(3);
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });

  it('sends the visitor to the login page when the session had really ended', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({ getOwnProfile: profileFailsOnce() });
    renderGuard(auth);
    await area();
    await failARefresh(user);
    auth.getSession.mockResolvedValueOnce(ok(null));

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'admin area' })).not.toBeInTheDocument();
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps offering the retry while the load keeps failing, and recovers when it works', async () => {
    const user = userEvent.setup();
    // The first retry waits for the profile until the test lets it fail.
    let failProfile;
    const getOwnProfile = vi.fn()
      .mockResolvedValueOnce(ok(ADMIN))
      .mockResolvedValueOnce(fail('NETWORK'))
      .mockImplementationOnce(() => new Promise((resolve) => {
        failProfile = () => resolve(fail('NETWORK'));
      }))
      .mockResolvedValue(ok(ADMIN));
    const auth = fakeAuth({ getOwnProfile });
    renderGuard(auth);
    await area();
    await failARefresh(user);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cargando…'));
    act(() => { failProfile(); });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await area()).toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledTimes(3);
    expect(auth.subscribe).toHaveBeenCalledTimes(1);
  });

  // A sign-out that fails is a failed action and not a failed load: the guard has
  // no error to show and no retry to offer, the area stays, and the sign-out can be
  // pressed again.
  it('keeps the area, with no alert and no retry, after a sign-out that failed', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({
      signOut: vi.fn().mockResolvedValueOnce(fail('NETWORK')).mockResolvedValue(ok()),
    });
    renderGuard(auth);
    await area();

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(await area()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.getOwnProfile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
