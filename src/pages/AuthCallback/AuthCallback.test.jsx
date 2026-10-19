import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionContext from '../../features/accounts/composition/SessionProvider';
import AuthCallback from './AuthCallback';

function fakeSession(overrides = {}) {
  return {
    status: 'signed-out',
    session: null,
    profile: null,
    errorCode: null,
    start: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderCallback({ session = fakeSession(), url = '/auth/callback' } = {}) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
  return { session };
}

const CONFIRMED = 'Tu correo está confirmado. Ingresa con tu correo y contraseña.';
const FAILED = 'No pudimos completar el ingreso. Inténtalo de nuevo.';

describe('AuthCallback', () => {
  it('starts the session: a fresh return has no stored session for the app to find by itself', () => {
    const { session } = renderCallback();

    expect(session.start).toHaveBeenCalledTimes(1);
  });

  it.each(['idle', 'loading'])('says it is checking while the status is %s', (status) => {
    renderCallback({ session: fakeSession({ status }) });

    expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando tu acceso…');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends a signed-in member to the home page, leaving no callback in the history', () => {
    renderCallback({
      session: fakeSession({
        status: 'signed-in',
        session: { userId: 'user-1', email: 'ana@example.test' },
        profile: {
          id: 'user-1', fullName: 'Ana Perez', consentVersion: '2026-01-01', consentAt: '2026-10-01T10:00:00+00:00', isAdmin: false,
        },
      }),
    });

    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Ingresar' })).not.toBeInTheDocument();
  });

  describe('without a session', () => {
    it('tells the member the address is confirmed and links to the sign-in page', () => {
      renderCallback();

      expect(screen.getByRole('status')).toHaveTextContent(CONFIRMED);
      expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says the same when the code in the address could not be used, as on another browser', () => {
      renderCallback({ url: '/auth/callback?code=a-single-use-code' });

      expect(screen.getByRole('status')).toHaveTextContent(CONFIRMED);
    });

    it.each([
      ['in the query', '/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
      ['in the fragment', '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
    ])('says it could not complete the sign-in when Auth reports an error %s, without repeating it', (_where, url) => {
      renderCallback({ url });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(FAILED);
      expect(document.body).not.toHaveTextContent(/invalid or has expired|otp_expired|access_denied/);
      expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/login');
      expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
    });

    it('says it could not complete the sign-in when the session could not be loaded', () => {
      renderCallback({ session: fakeSession({ status: 'error', errorCode: 'NETWORK' }) });

      expect(screen.getByRole('alert')).toHaveTextContent(FAILED);
      expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/login');
    });
  });
});
