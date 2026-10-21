import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  Link, MemoryRouter, Route, Routes,
} from 'react-router-dom';

import BackendContext from '../../shared/backend/BackendContext';
import AdminMemberDetail from './AdminMemberDetail';

const ANA_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const BETO_ID = '9f1e6a52-0c1d-4f8e-9a57-2d1c3b4a5e60';

const ok = (data) => ({ ok: true, data });
const member = (id, fullName) => ({
  id, fullName, email: `${fullName.split(' ')[0].toLowerCase()}@example.test`, paidUntil: '2026-10-31', isActive: true,
});
const MEMBERS = { [ANA_ID]: member(ANA_ID, 'Ana Perez'), [BETO_ID]: member(BETO_ID, 'Beto Ruiz') };

// A call the test settles by hand, to hold it in flight.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeMembership(overrides = {}) {
  return {
    getMember: vi.fn(async (id) => (MEMBERS[id] ? ok(MEMBERS[id]) : { ok: false, code: 'NOT_FOUND' })),
    listPeriods: vi.fn(async () => ok([])),
    ...overrides,
  };
}

function renderAt(path, membership = fakeMembership()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BackendContext.Provider value={{ enabled: true, services: { membership } }}>
        <Link to={`/admin/members/${BETO_ID}`}>go to the other member</Link>
        <Link to="/admin/members/not-a-uuid">go to something that is no id</Link>
        <Routes>
          <Route path="/admin/members" element={<p>the directory</p>} />
          <Route path="/admin/members/:memberId" element={<AdminMemberDetail />} />
        </Routes>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
  return membership;
}

const title = (name) => screen.findByRole('heading', { level: 2, name });

describe('AdminMemberDetail', () => {
  it('shows the member whose id is in the address, asking for exactly that one', async () => {
    const membership = renderAt(`/admin/members/${ANA_ID}`);

    expect(await title('Ana Perez')).toBeInTheDocument();
    expect(membership.getMember).toHaveBeenCalledTimes(1);
    expect(membership.getMember).toHaveBeenCalledWith(ANA_ID);
    expect(membership.listPeriods).toHaveBeenCalledTimes(1);
    expect(membership.listPeriods).toHaveBeenCalledWith(ANA_ID);
  });

  it.each([
    ['a word', 'not-a-uuid'],
    ['a number', '12345'],
    ['an id with something more', `${ANA_ID}-x`],
  ])('asks for nothing, and says the member is not there, when the address holds %s', async (_label, id) => {
    const membership = renderAt(`/admin/members/${id}`);

    expect(screen.getByRole('heading', { level: 2, name: 'Miembro no encontrado' }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a miembros' })).toBeInTheDocument();
    await act(async () => {});

    expect(membership.getMember).not.toHaveBeenCalled();
    expect(membership.listPeriods).not.toHaveBeenCalled();
  });

  it('shows another member when the address changes, and never the first one in between', async () => {
    const beto = deferred();
    const membership = fakeMembership({
      getMember: vi.fn((id) => (id === BETO_ID
        ? beto.promise
        : Promise.resolve(ok(MEMBERS[id])))),
    });
    renderAt(`/admin/members/${ANA_ID}`, membership);
    await title('Ana Perez');

    fireEvent.click(screen.getByRole('link', { name: 'go to the other member' }));

    expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    expect(screen.queryByText('ana@example.test')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando al miembro…');
    expect(membership.getMember).toHaveBeenLastCalledWith(BETO_ID);
    expect(membership.listPeriods).toHaveBeenLastCalledWith(BETO_ID);

    await act(async () => { beto.resolve(ok(MEMBERS[BETO_ID])); });

    expect(await title('Beto Ruiz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
  });

  it('leaves the member that was open when the address moves to something that is not an id', async () => {
    const membership = renderAt(`/admin/members/${ANA_ID}`);
    await title('Ana Perez');

    fireEvent.click(screen.getByRole('link', { name: 'go to something that is no id' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Miembro no encontrado' }))
      .toBeInTheDocument();
    expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    await act(async () => {});
    expect(membership.getMember).toHaveBeenCalledTimes(1);
    expect(membership.listPeriods).toHaveBeenCalledTimes(1);
  });

  it('goes back to the directory from the way back link', async () => {
    renderAt(`/admin/members/${ANA_ID}`);
    await title('Ana Perez');

    fireEvent.click(screen.getByRole('link', { name: 'Volver a miembros' }));

    expect(screen.getByText('the directory')).toBeInTheDocument();
    expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
  });

  it('writes the id nowhere on the screen', async () => {
    renderAt(`/admin/members/${ANA_ID}`);
    await title('Ana Perez');

    expect(document.body).not.toHaveTextContent(ANA_ID);
  });
});
