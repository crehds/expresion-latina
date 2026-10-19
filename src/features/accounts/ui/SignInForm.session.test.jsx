// Signing in with the real SessionProvider: what the member ends up as when the
// password was accepted but loading the session into the app failed. The unit
// tests of SignInForm fake the whole session; this one fakes only the auth
// adapter, the way supabase-js behaves (an accepted password stores the session
// and tells every subscriber).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import { SessionProvider, useSession } from '../composition/SessionProvider';
import SignInForm from './SignInForm';

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
// works: the first `session.start()` after the sign-in then rejects.
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
    signInWithPassword: vi.fn(async () => {
      stored = SESSION;
      listener?.(SESSION);
      return ok();
    }),
  };
}

function Home() {
  const { status } = useSession();
  return <output data-testid="home-status">{status}</output>;
}

function renderApp(auth) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <SessionProvider>
          <Routes>
            <Route path="/login" element={<SignInForm />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </SessionProvider>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), 'ana@example.test');
  await user.type(screen.getByLabelText('Contraseña'), 'abcdefg1');
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('SignInForm with the real session provider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('ends signed in on the home page after a plain sign-in', async () => {
    renderApp(fakeSupabaseAuth());

    await signIn();

    await waitFor(() => expect(screen.getByTestId('home-status')).toHaveTextContent('signed-in'));
  });

  it('still ends signed in, without a reload, when starting the session rejects after an accepted password', async () => {
    const auth = fakeSupabaseAuth({ loadFailures: 1 });
    renderApp(auth);

    await signIn();

    expect(await screen.findByTestId('home-status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('home-status')).toHaveTextContent('signed-in'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
