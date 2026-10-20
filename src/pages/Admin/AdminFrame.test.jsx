import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminFrame from './AdminFrame';

function renderFrame(path = '/admin/members') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminFrame />}>
          <Route path="/admin/members" element={<h2>members page</h2>} />
          <Route path="/admin/members/:memberId" element={<h2>member page</h2>} />
        </Route>
      </Routes>
    </MemoryRouter>,
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

    expect(links.map((link) => link.textContent)).toEqual(['Miembros']);
    expect(links[0]).toHaveAttribute('href', '/admin/members');
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
});
