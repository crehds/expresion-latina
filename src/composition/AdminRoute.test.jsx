import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import SessionContext from '../features/accounts/composition/SessionProvider';
import useMembership from '../features/membership/composition/useMembership';
import BackendContext from '../shared/backend/BackendContext';
import AdminRoute from './AdminRoute';

const SESSION = { userId: 'user-1', email: 'ana@example.test' };

const profile = (isAdmin) => ({
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin,
});

const sessionValue = (overrides = {}) => ({
  status: 'signed-in',
  session: SESSION,
  profile: profile(true),
  errorCode: null,
  start: vi.fn(async () => {}),
  refresh: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  ...overrides,
});

const SIGNED_OUT = { status: 'signed-out', session: null, profile: null };

// Counts every mount of the protected area, even for an instant, and uses the
// membership adapter the way an admin page does as soon as it is shown.
const mounts = vi.fn();
const searchMembers = vi.fn(async () => ({ ok: true, data: [] }));

function AdminArea() {
  const membership = useMembership();
  useEffect(() => {
    mounts();
    membership?.searchMembers('');
  }, [membership]);
  return <h1>admin area</h1>;
}

const backend = { enabled: true, services: { membership: { searchMembers } } };

function tree(value) {
  return (
    <MemoryRouter initialEntries={['/admin/members']}>
      <BackendContext.Provider value={backend}>
        <SessionContext.Provider value={value}>
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/admin/members"
                element={<AdminRoute><AdminArea /></AdminRoute>}
              />
              <Route path="/login" element={<p>login page</p>} />
            </Routes>
          </Suspense>
        </SessionContext.Provider>
      </BackendContext.Provider>
    </MemoryRouter>
  );
}

function renderGuard(overrides) {
  const value = sessionValue(overrides);
  const view = render(tree(value));
  return { value, ...view };
}

const notFoundHeading = () => screen.findByRole('heading', { level: 1, name: 'No encontramos esta página' });

describe('AdminRoute', () => {
  beforeEach(() => {
    mounts.mockClear();
    searchMembers.mockClear();
  });

  describe('starting the session', () => {
    it('starts the session on mount, so a visitor with nothing stored resolves to signed out', () => {
      const { value } = renderGuard(SIGNED_OUT);

      expect(value.start).toHaveBeenCalledTimes(1);
    });

    it('tries the start once more when it rejects, and stays quiet', async () => {
      const start = vi.fn()
        .mockRejectedValueOnce(new Error('store unavailable'))
        .mockResolvedValueOnce(undefined);

      renderGuard({ start });

      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole('heading', { level: 1, name: 'admin area' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('while the session loads', () => {
    it.each(['idle', 'loading'])('shows a loading status and mounts nothing when the status is %s', (status) => {
      renderGuard({ ...SIGNED_OUT, status });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
      expect(searchMembers).not.toHaveBeenCalled();
    });

    it('mounts the area only once the profile says the member is an administrator', async () => {
      const { rerender, value } = renderGuard({ ...SIGNED_OUT, status: 'loading' });
      expect(mounts).not.toHaveBeenCalled();

      rerender(tree({
        ...value, status: 'signed-in', session: SESSION, profile: profile(true),
      }));

      expect(await screen.findByRole('heading', { level: 1, name: 'admin area' })).toBeInTheDocument();
      expect(mounts).toHaveBeenCalledTimes(1);
    });
  });

  describe('without a session', () => {
    it('sends a signed-out visitor to the login page, mounting nothing', async () => {
      renderGuard(SIGNED_OUT);

      expect(await screen.findByText('login page')).toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
      expect(searchMembers).not.toHaveBeenCalled();
    });

    it('sends an error with no session to the login page', async () => {
      renderGuard({
        status: 'error', session: null, profile: null, errorCode: 'NETWORK',
      });

      expect(await screen.findByText('login page')).toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
    });

    it('sends an administrator whose session ends to the login page', async () => {
      const { rerender, value } = renderGuard();
      expect(await screen.findByRole('heading', { name: 'admin area' })).toBeInTheDocument();

      rerender(tree({ ...value, ...SIGNED_OUT }));

      expect(await screen.findByText('login page')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'admin area' })).not.toBeInTheDocument();
    });
  });

  describe('when the session fails to load', () => {
    const failed = {
      status: 'error', session: SESSION, profile: null, errorCode: 'NETWORK',
    };

    it('shows an alert with a way to try again, mounting nothing and not redirecting', () => {
      renderGuard(failed);

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos comprobar tu acceso. Inténtalo de nuevo.');
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
    });

    it('starts the session again when the member asks', async () => {
      const user = userEvent.setup();
      const { value } = renderGuard(failed);

      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(value.start).toHaveBeenCalledTimes(2);
    });

    it('goes through the shared start helper, so a rejected start stays quiet', async () => {
      const user = userEvent.setup();
      const start = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('store unavailable'));
      renderGuard({ ...failed, start });

      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      // One call on mount, then the click and the helper's own second attempt.
      await waitFor(() => expect(start).toHaveBeenCalledTimes(3));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('for a signed-in member', () => {
    it('renders the area for an administrator', async () => {
      renderGuard();

      expect(await screen.findByRole('heading', { level: 1, name: 'admin area' })).toBeInTheDocument();
      expect(mounts).toHaveBeenCalledTimes(1);
      expect(searchMembers).toHaveBeenCalledTimes(1);
    });

    it('renders the not-found page for a member who is not an administrator, never mounting the area', async () => {
      renderGuard({ profile: profile(false) });

      expect(await notFoundHeading()).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'admin area' })).not.toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
      expect(searchMembers).not.toHaveBeenCalled();
    });

    it('treats a profile that did not load as not an administrator', async () => {
      renderGuard({ profile: null });

      expect(await notFoundHeading()).toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
      expect(searchMembers).not.toHaveBeenCalled();
    });

    it.each(['true', 1, {}])('requires the flag to be exactly true, not %j', async (isAdmin) => {
      renderGuard({ profile: profile(isAdmin) });

      expect(await notFoundHeading()).toBeInTheDocument();
      expect(mounts).not.toHaveBeenCalled();
    });

    it('does not tell the member that an administration area exists', async () => {
      renderGuard({ profile: profile(false) });

      await notFoundHeading();

      expect(screen.queryByText(/administraci[oó]n/i)).not.toBeInTheDocument();
    });
  });

  it('renders the not-found page and mounts nothing when the backend is off', async () => {
    renderGuard({ status: 'disabled', session: null, profile: null });

    expect(await notFoundHeading()).toBeInTheDocument();
    expect(mounts).not.toHaveBeenCalled();
    expect(searchMembers).not.toHaveBeenCalled();
  });

  it('trusts the profile only while the status is signed in', async () => {
    renderGuard({ status: 'disabled', session: null, profile: profile(true) });

    expect(await notFoundHeading()).toBeInTheDocument();
    expect(mounts).not.toHaveBeenCalled();
  });
});
