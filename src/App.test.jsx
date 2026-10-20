import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
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
  // The kill switch reads the environment when the provider mounts, and a local
  // env file or a shell can hold both variables, so this case blanks them
  // itself instead of trusting the machine it runs on.
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  function renderPending(path) {
    window.sessionStorage.clear();
    return render(
      <MemoryRouter initialEntries={[path]}>
        <BackendContext.Provider value={{ enabled: true, services: { auth: {} } }}>
          <SessionContext.Provider value={pendingSession}>
            <App />
          </SessionContext.Provider>
        </BackendContext.Provider>
      </MemoryRouter>,
    );
  }

  it('replaces the page with the consent screen and keeps the header', async () => {
    renderPending('/contact');

    expect(await screen.findByRole('heading', { level: 1, name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mapa/ })).not.toBeInTheDocument();
  });

  it('lets the member read the privacy notice instead of the consent screen', async () => {
    renderPending('/privacy');

    expect(await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad' }, { timeout: 5000 }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Necesitamos tu consentimiento' }))
      .not.toBeInTheDocument();
  });
});

describe('App account routes', () => {
  const ROUTES = [
    '/login',
    '/auth/callback',
    '/auth/confirm',
    '/privacy',
    '/account',
    '/admin/members',
    '/admin/members/00000000-0000-4000-8000-000000000000',
  ];

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

    it('renders the email link page at /auth/confirm, and verifies nothing on its own', async () => {
      const verifyEmailLink = vi.fn();
      const services = { auth: { verifyEmailLink } };
      render(
        <MemoryRouter initialEntries={['/auth/confirm?token_hash=hash-1&type=recovery']}>
          <BackendContext.Provider value={{ enabled: true, services }}>
            <SessionContext.Provider value={signedOut}>
              <App />
            </SessionContext.Provider>
          </BackendContext.Provider>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('button', { name: 'Continuar' }, { timeout: 5000 }))
        .toBeInTheDocument();
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
      expect(verifyEmailLink).not.toHaveBeenCalled();
    });

    it('renders the privacy notice at /privacy', async () => {
      renderOn('/privacy');

      expect(await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad' }, { timeout: 5000 }))
        .toBeInTheDocument();
      expect(screen.getByText(/^Versión \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    it('renders the account page at /account for a signed-in member', async () => {
      const signedIn = {
        ...signedOut,
        status: 'signed-in',
        session: { userId: 'user-1', email: 'ana@example.test' },
        profile: {
          id: 'user-1',
          fullName: 'Ana Perez',
          consentVersion: '2026-01-01',
          consentAt: '2026-10-01T10:00:00+00:00',
          isAdmin: false,
        },
      };
      render(
        <MemoryRouter initialEntries={['/account']}>
          <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
            <SessionContext.Provider value={signedIn}>
              <App />
            </SessionContext.Provider>
          </BackendContext.Provider>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Mi cuenta' }, { timeout: 5000 }))
        .toBeInTheDocument();
      expect(screen.getByText('ana@example.test')).toBeInTheDocument();
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    it('sends a visitor from /account to the login page', async () => {
      renderOn('/account');

      expect(await screen.findByRole('heading', { level: 1, name: 'Ingresar' }, { timeout: 5000 }))
        .toBeInTheDocument();
    });

    it('asks the backend for nothing and starts no session at /privacy', async () => {
      const session = {
        ...signedOut,
        start: vi.fn(async () => {}),
        refresh: vi.fn(async () => {}),
      };
      const services = {
        auth: { getProviders: vi.fn(async () => ({ ok: true, data: { google: false } })) },
      };
      render(
        <MemoryRouter initialEntries={['/privacy']}>
          <BackendContext.Provider value={{ enabled: true, services }}>
            <SessionContext.Provider value={session}>
              <App />
            </SessionContext.Provider>
          </BackendContext.Provider>
        </MemoryRouter>,
      );

      await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad' }, { timeout: 5000 });

      expect(session.start).not.toHaveBeenCalled();
      expect(session.refresh).not.toHaveBeenCalled();
      expect(services.auth.getProviders).not.toHaveBeenCalled();
    });

    it('still renders the public routes', async () => {
      renderOn('/contact');

      expect(await screen.findByRole('button', { name: /Mapa/ }, { timeout: 5000 })).toBeInTheDocument();
    });
  });
});

describe('App admin routes', () => {
  const profile = (isAdmin) => ({
    id: 'user-1',
    fullName: 'Ana Perez',
    consentVersion: '2026-01-01',
    consentAt: '2026-10-01T10:00:00+00:00',
    isAdmin,
  });
  const sessionOf = (overrides) => ({
    status: 'signed-in',
    session: { userId: 'user-1', email: 'ana@example.test' },
    profile: profile(true),
    errorCode: null,
    start: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  });
  const SIGNED_OUT = { status: 'signed-out', session: null, profile: null };

  const MEMBER_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
  const member = {
    id: MEMBER_ID,
    fullName: 'Beto Ruiz',
    email: 'beto@example.test',
    paidUntil: '2026-10-31',
    isActive: true,
  };

  function renderAdmin(path, session) {
    const searchMembers = vi.fn(async () => ({ ok: true, data: [member] }));
    const getMember = vi.fn(async () => ({ ok: true, data: member }));
    const listPeriods = vi.fn(async () => ({ ok: true, data: [] }));
    const services = {
      auth: { getProviders: vi.fn(async () => ({ ok: true, data: { google: false } })) },
      membership: { searchMembers, getMember, listPeriods },
    };
    render(
      <MemoryRouter initialEntries={[path]}>
        <BackendContext.Provider value={{ enabled: true, services }}>
          <SessionContext.Provider value={session}>
            <App />
          </SessionContext.Provider>
        </BackendContext.Provider>
      </MemoryRouter>,
    );
    return {
      searchMembers, getMember, listPeriods, session,
    };
  }

  const heading = (level, name) => screen.findByRole('heading', { level, name }, { timeout: 5000 });

  it('sends a visitor from the members page to the login page, asking the backend for nothing', async () => {
    const { searchMembers, session } = renderAdmin('/admin/members', sessionOf(SIGNED_OUT));

    expect(await heading(1, 'Ingresar')).toBeInTheDocument();
    expect(session.start).toHaveBeenCalled();
    expect(searchMembers).not.toHaveBeenCalled();
  });

  it('renders the not-found page for a member who is not an administrator, asking the backend for nothing', async () => {
    const { searchMembers } = renderAdmin('/admin/members', sessionOf({ profile: profile(false) }));

    expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Miembros' })).not.toBeInTheDocument();
    expect(searchMembers).not.toHaveBeenCalled();
  });

  it('sends a visitor from the page of a member to the login page, asking the backend for nothing', async () => {
    const { getMember, listPeriods, session } = renderAdmin(
      `/admin/members/${MEMBER_ID}`,
      sessionOf(SIGNED_OUT),
    );

    expect(await heading(1, 'Ingresar')).toBeInTheDocument();
    expect(session.start).toHaveBeenCalled();
    expect(getMember).not.toHaveBeenCalled();
    expect(listPeriods).not.toHaveBeenCalled();
  });

  it('renders the not-found page at the page of a member for someone who is not an administrator, asking the backend for nothing', async () => {
    const { getMember, listPeriods } = renderAdmin(
      `/admin/members/${MEMBER_ID}`,
      sessionOf({ profile: profile(false) }),
    );

    expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Beto Ruiz' })).not.toBeInTheDocument();
    expect(getMember).not.toHaveBeenCalled();
    expect(listPeriods).not.toHaveBeenCalled();
  });

  it('answers not found at the page of a member while the backend is off, even for an administrator session', async () => {
    render(
      <MemoryRouter initialEntries={[`/admin/members/${MEMBER_ID}`]}>
        <SessionContext.Provider value={sessionOf()}>
          <App />
        </SessionContext.Provider>
      </MemoryRouter>,
    );

    expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('answers not found while the backend is off, even if a session says the member is an administrator', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/members']}>
        <SessionContext.Provider value={sessionOf()}>
          <App />
        </SessionContext.Provider>
      </MemoryRouter>,
    );

    expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
  });

  describe('for an administrator', () => {
    it('renders the members page inside the admin frame', async () => {
      const { searchMembers } = renderAdmin('/admin/members', sessionOf());

      expect(await heading(1, 'Administración')).toBeInTheDocument();
      expect(await heading(2, 'Miembros')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Beto Ruiz' }))
        .toHaveAttribute('href', `/admin/members/${MEMBER_ID}`);
      expect(searchMembers).toHaveBeenCalledWith('');
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    // A link in the directory used to lead to the catch-all not-found page, because no
    // route answered to the address of a member.
    it('follows a member link from the directory to the page of that member, inside the same admin frame', async () => {
      const { getMember, listPeriods } = renderAdmin('/admin/members', sessionOf());
      await heading(1, 'Administración');

      fireEvent.click(await screen.findByRole('link', { name: 'Beto Ruiz' }));

      expect(await heading(2, 'Beto Ruiz')).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument();
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(screen.queryByRole('heading', { level: 2, name: 'Miembros' })).not.toBeInTheDocument();
      expect(await heading(3, 'Pagos registrados')).toBeInTheDocument();
      expect(getMember).toHaveBeenCalledWith(MEMBER_ID);
      expect(listPeriods).toHaveBeenCalledWith(MEMBER_ID);
      expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
    });

    it('renders the page of a member at its address, with the members entry of the sub-navigation marked', async () => {
      const { getMember } = renderAdmin(`/admin/members/${MEMBER_ID}`, sessionOf());

      expect(await heading(2, 'Beto Ruiz')).toBeInTheDocument();
      expect(screen.getByText('beto@example.test')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Pagado hasta 31 de octubre de 2026')).toBeInTheDocument();
      const subNavigation = screen.getByRole('navigation', { name: 'Secciones de administración' });
      expect(within(subNavigation).getByRole('link', { name: 'Miembros' }))
        .toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('Admin')).toHaveAttribute('aria-current', 'page');
      expect(getMember).toHaveBeenCalledTimes(1);
    });

    it('goes back from the page of a member to the directory, which lists the members again', async () => {
      const { searchMembers } = renderAdmin(`/admin/members/${MEMBER_ID}`, sessionOf());
      await heading(2, 'Beto Ruiz');

      fireEvent.click(screen.getByRole('link', { name: 'Volver a miembros' }));

      expect(await heading(2, 'Miembros')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Beto Ruiz' })).toBeInTheDocument();
      expect(searchMembers).toHaveBeenCalledWith('');
    });

    it('says inside the frame that the member is not there for an address that holds no id, asking for nothing', async () => {
      const { getMember, listPeriods } = renderAdmin('/admin/members/not-a-uuid', sessionOf());

      expect(await heading(2, 'Miembro no encontrado')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument();
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Volver a miembros' })).toBeInTheDocument();
      expect(getMember).not.toHaveBeenCalled();
      expect(listPeriods).not.toHaveBeenCalled();
    });

    it('does not turn a longer address into the page of a member', async () => {
      const { getMember } = renderAdmin(`/admin/members/${MEMBER_ID}/payments`, sessionOf());

      expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
      expect(getMember).not.toHaveBeenCalled();
    });

    it('marks the members page in the sub-navigation and the Admin entry of the menu', async () => {
      renderAdmin('/admin/members', sessionOf());

      await heading(1, 'Administración');

      const subNavigation = screen.getByRole('navigation', { name: 'Secciones de administración' });
      expect(within(subNavigation).getByRole('link', { name: 'Miembros' }))
        .toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('Admin')).toHaveAttribute('aria-current', 'page');
      await screen.findByText('Beto Ruiz');
    });

    it('does not turn /admin on its own into an empty admin page', async () => {
      const { searchMembers } = renderAdmin('/admin', sessionOf());

      expect(await heading(1, /no encontramos/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument();
      expect(searchMembers).not.toHaveBeenCalled();
    });
  });
});
