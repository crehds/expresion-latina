import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import BackendContext from '../../shared/backend/BackendContext';
import AdminMembers from './AdminMembers';

function renderPage(searchMembers) {
  const services = { membership: { searchMembers } };
  return render(
    <MemoryRouter>
      <BackendContext.Provider value={{ enabled: true, services }}>
        <AdminMembers />
      </BackendContext.Provider>
    </MemoryRouter>,
  );
}

describe('AdminMembers', () => {
  const ana = {
    id: 'id-1',
    fullName: 'Ana Perez',
    email: 'ana@example.test',
    paidUntil: '2026-10-31',
    isActive: true,
  };

  it('is a section with a level 2 heading, the heading of the frame being the level 1', async () => {
    renderPage(vi.fn(async () => ({ ok: true, data: [ana] })));

    const section = screen.getByRole('region', { name: 'Miembros' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Miembros' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    await screen.findByText('Ana Perez');
  });

  it('holds the search of the directory, already listing it', async () => {
    const searchMembers = vi.fn(async () => ({ ok: true, data: [ana] }));

    renderPage(searchMembers);

    const section = screen.getByRole('region', { name: 'Miembros' });
    expect(within(section).getByRole('search')).toBeInTheDocument();
    expect(await within(section).findByRole('link', { name: 'Ana Perez' }))
      .toHaveAttribute('href', '/admin/members/id-1');
    expect(searchMembers).toHaveBeenCalledWith('');
  });
});
