import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

import App from './App';
import SessionContext from './features/accounts/composition/SessionProvider';
import BackendContext, { BackendProvider } from './shared/backend/BackendContext';

// Every page is behind React.lazy, so rendering is not finished until the
// route's chunk has resolved. Waiting here keeps that resolution inside the
// test rather than letting it land after the assertions.
async function renderAt(path) {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

  // Well above the 1s default: jest transforms every image and video the data
  // layer registers before this chunk resolves, which takes about 1.2s here.
  await screen.findByRole('button', { name: /Mapa/ }, { timeout: 5000 });

  return result;
}

// Everything else here uses MemoryRouter, which cannot catch a wrong base
// path. This renders the production configuration: a real BrowserRouter
// reading PUBLIC_URL, which is what a blank deployed page comes down to.
describe('App mounted the way it is deployed', () => {
  it('matches a route at the site root', async () => {
    render(
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>,
    );

    // findAll, not find: the carousel wraps around, so it clones its slides.
    const posters = await screen.findAllByRole('img', { name: 'Casting de la academia' });

    expect(posters.length).toBeGreaterThan(0);
  });
});

describe('App', () => {
  it('renders every navigation entry', async () => {
    await renderAt('/contact');

    [
      'Inicio',
      'Profesores',
      'Clases',
      'Horario',
      'Encuéntranos',
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Opinions are a section of the landing page, not somewhere to navigate
    // to, so the menu must not offer them.
    expect(screen.queryByText('Reseñas')).not.toBeInTheDocument();
  });

  it('marks the entry for the current route as active', async () => {
    await renderAt('/contact');

    expect(screen.getByText('Encuéntranos')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Inicio')).not.toHaveAttribute('aria-current');
  });

  // Proves the Suspense boundary and the route's chunk resolve rather than
  // leaving the loader on screen forever.
  it('resolves the lazy chunk for a route', async () => {
    await renderAt('/contact');

    expect(screen.getByRole('button', { name: /Info/ })).toBeInTheDocument();
  });
});

describe('App with the backend disabled', () => {
  // The default build: no env vars, so no kill switch to flip and nothing to create.
  it('renders the public routes as before and creates no services', async () => {
    const createServices = vi.fn();
    render(
      <MemoryRouter initialEntries={['/contact']}>
        <BackendProvider createServices={createServices}>
          <App />
        </BackendProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Mapa/ }, { timeout: 5000 }))
      .toBeInTheDocument();
    expect(screen.getByText('Encuéntranos')).toHaveAttribute('aria-current', 'page');
    expect(createServices).not.toHaveBeenCalled();
  });
});

describe('App with a pending consent', () => {
  const pendingSession = {
    status: 'signed-in',
    session: { userId: 'user-1', email: 'ana@example.test' },
    profile: {
      id: 'user-1', fullName: '', consentVersion: null, consentAt: null, isAdmin: false,
    },
    errorCode: null,
    start: vi.fn(),
    refresh: vi.fn(),
    signOut: vi.fn(),
  };

  it('replaces the page with the consent screen and keeps the header', async () => {
    window.sessionStorage.clear();
    render(
      <MemoryRouter initialEntries={['/contact']}>
        <BackendContext.Provider value={{ enabled: true, services: { auth: {} } }}>
          <SessionContext.Provider value={pendingSession}>
            <App />
          </SessionContext.Provider>
        </BackendContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mapa/ })).not.toBeInTheDocument();
  });
});

describe('App account routes', () => {
  const ROUTES = ['/login', '/auth/callback'];

  it.each(ROUTES)('renders the not-found page at %s while the backend is off', async (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: /no encontramos/i }, { timeout: 5000 }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Ingresar' })).not.toBeInTheDocument();
  });

  describe('while the backend is on', () => {
    const signedOut = {
      status: 'signed-out',
      session: null,
      profile: null,
      errorCode: null,
      start: vi.fn(async () => {}),
      refresh: vi.fn(async () => {}),
      signOut: vi.fn(async () => {}),
    };
    const auth = { getProviders: vi.fn(async () => ({ ok: true, data: { google: false } })) };

    function renderOn(path) {
      return render(
        <MemoryRouter initialEntries={[path]}>
          <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
            <SessionContext.Provider value={signedOut}>
              <App />
            </SessionContext.Provider>
          </BackendContext.Provider>
        </MemoryRouter>,
      );
    }

    it('renders the login page at /login', async () => {
      renderOn('/login');

      expect(await screen.findByRole('heading', { level: 1, name: 'Ingresar' }, { timeout: 5000 }))
        .toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Aviso de privacidad/ })).toBeInTheDocument();
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    it('renders the auth callback page at /auth/callback', async () => {
      renderOn('/auth/callback');

      expect(await screen.findByRole('link', { name: 'Ir a ingresar' }, { timeout: 5000 }))
        .toHaveAttribute('href', '/login');
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    it('still renders the public routes', async () => {
      renderOn('/contact');

      expect(await screen.findByRole('button', { name: /Mapa/ }, { timeout: 5000 })).toBeInTheDocument();
    });
  });
});
