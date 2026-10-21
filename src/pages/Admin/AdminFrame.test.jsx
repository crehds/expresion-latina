import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import {
  Link, MemoryRouter, Route, Routes,
} from 'react-router-dom';

import BackendContext from '../../shared/backend/BackendContext';
import AdminFrame from './AdminFrame';

function renderFrame(path = '/admin/members', services = null) {
  return render(
    <BackendContext.Provider value={{ enabled: services !== null, services }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AdminFrame />}>
            <Route
              path="/admin/members"
              element={(
                <>
                  <h2>members page</h2>
                  <Link to="/admin/members/member-1">open a member</Link>
                </>
              )}
            />
            <Route path="/admin/members/:memberId" element={<h2>member page</h2>} />
            <Route path="/admin/attendance" element={<h2>attendance page</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </BackendContext.Provider>,
  );
}

const subNavigation = () => screen.getByRole('navigation', { name: 'Secciones de administración' });

describe('AdminFrame', () => {
  it('gives every admin page one main landmark and one level 1 heading', () => {
    renderFrame();

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument();
  });

  it('renders the page of the current route inside the frame', () => {
    renderFrame('/admin/members/member-1');

    expect(within(screen.getByRole('main')).getByRole('heading', { level: 2, name: 'member page' }))
      .toBeInTheDocument();
    expect(screen.queryByText('members page')).not.toBeInTheDocument();
  });

  it('lists the admin pages that exist, and only those', () => {
    renderFrame();

    const links = within(subNavigation()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['Miembros', 'Asistencia']);
    expect(links.map((link) => link.getAttribute('href')))
      .toEqual(['/admin/members', '/admin/attendance']);
  });

  it('marks the attendance page, and only it, when that page is shown', () => {
    renderFrame('/admin/attendance');

    expect(within(subNavigation()).getByRole('link', { name: 'Asistencia' }))
      .toHaveAttribute('aria-current', 'page');
    expect(within(subNavigation()).getByRole('link', { name: 'Miembros' }))
      .not.toHaveAttribute('aria-current');
  });

  it('marks the page being shown as the current one', () => {
    renderFrame();

    expect(within(subNavigation()).getByRole('link', { name: 'Miembros' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('keeps the page marked on the pages under it', () => {
    renderFrame('/admin/members/member-1');

    expect(within(subNavigation()).getByRole('link', { name: 'Miembros' }))
      .toHaveAttribute('aria-current', 'page');
  });

  describe('the keep-alive notice', () => {
    const withNoPing = () => ({
      membership: { getLastPing: vi.fn(async () => ({ ok: true, data: null })) },
    });

    // The threshold comes from a build-time variable that a local env file may set.
    beforeEach(() => {
      vi.stubEnv('VITE_KEEPALIVE_ALERT_DAYS', '');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('sits right after the sub-navigation and right before the page', async () => {
      renderFrame('/admin/members', withNoPing());

      const notice = await screen.findByRole('status');
      const page = screen.getByRole('heading', { level: 2, name: 'members page' });
      const parts = Array.from(screen.getByRole('main').children);

      expect(notice).toHaveTextContent('Todavía no hay ningún ping de mantenimiento registrado.');
      expect(parts.indexOf(notice)).toBe(parts.indexOf(subNavigation()) + 1);
      expect(parts.indexOf(page)).toBe(parts.indexOf(notice) + 1);
    });

    it('stays while the administrator moves between admin pages, and reads only once', async () => {
      const services = withNoPing();
      renderFrame('/admin/members', services);
      await screen.findByRole('status');

      fireEvent.click(screen.getByRole('link', { name: 'open a member' }));

      expect(screen.getByRole('heading', { level: 2, name: 'member page' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(services.membership.getLastPing).toHaveBeenCalledTimes(1);
    });

    it('leaves the frame as it was when there is nothing to say', () => {
      renderFrame('/admin/members', { auth: {} });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'members page' })).toBeInTheDocument();
    });
  });
});
