// The confirmation page with the real SessionProvider: what the member ends up
// as when the link verified but loading the session into the app failed. The
// unit tests of AuthConfirm fake the whole session; this one fakes only the auth
// adapter, the way supabase-js behaves (a verified link stores the session and
// tells every subscriber).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BackendContext from '../../shared/backend/BackendContext';
import { SessionProvider, useSession } from '../../features/accounts/composition/SessionProvider';
import AuthConfirm from './AuthConfirm';

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};

const ok = (data = null) => ({ ok: true, data });

// `loadFailures` is how many reads of the stored session blow up before one
// works: the first `session.start()` after the link then rejects.
function fakeSupabaseAuth({ loadFailures = 0 } = {}) {
  let remainingFailures = loadFailures;
  let stored = null;
  let listener = null;
  return {
    getSession: vi.fn(async () => {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error('session store unavailable');
      }
      return ok(stored);
    }),
    subscribe: vi.fn(async (callback) => {
      listener = callback;
      return ok(() => { listener = null; });
    }),
    getOwnProfile: vi.fn(async () => ok(PROFILE)),
    verifyEmailLink: vi.fn(async () => {
      stored = SESSION;
      listener?.(SESSION);
      return ok();
    }),
    updatePassword: vi.fn(async () => ok()),
  };
}

function Home() {
  const { status } = useSession();
  return <output data-testid="home-status">{status}</output>;
}

function renderApp(auth, url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider>
          <Routes>
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </SessionProvider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

describe('AuthConfirm with the real session provider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('ends signed in on the home page when starting the session rejects once after a good email link', async () => {
    const user = userEvent.setup();
    renderApp(fakeSupabaseAuth({ loadFailures: 1 }), '/auth/confirm?token_hash=hash-1&type=email');

    await user.click(screen.getByRole('button', { name: 'Confirmar mi correo' }));

    expect(await screen.findByTestId('home-status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('home-status')).toHaveTextContent('signed-in'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still shows the new-password form when starting the session rejects once after a good recovery link', async () => {
    const user = userEvent.setup();
    const auth = fakeSupabaseAuth({ loadFailures: 1 });
    renderApp(auth, '/auth/confirm?token_hash=hash-2&type=recovery');

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
