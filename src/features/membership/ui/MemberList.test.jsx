import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import MemberList from './MemberList';

const member = (overrides = {}) => ({
  id: '3b241101-e2bb-4255-8caf-4136c566a962',
  fullName: 'Ana Perez',
  email: 'ana@example.test',
  paidUntil: '2026-10-31',
  isActive: true,
  ...overrides,
});

function renderList(members) {
  return render(
    <MemoryRouter>
      <MemberList members={members} />
    </MemoryRouter>,
  );
}

const rows = () => screen.getAllByRole('listitem');

describe('MemberList', () => {
  it('lists one row per member, in the order given', () => {
    renderList([
      member({ id: 'id-1', fullName: 'Ana Perez' }),
      member({ id: 'id-2', fullName: 'Beto Ruiz' }),
    ]);

    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).getByText('Ana Perez')).toBeInTheDocument();
    expect(within(rows()[1]).getByText('Beto Ruiz')).toBeInTheDocument();
  });

  it('names the member and shows the email', () => {
    renderList([member()]);

    expect(within(rows()[0]).getByText('Ana Perez')).toBeInTheDocument();
    expect(within(rows()[0]).getByText('ana@example.test')).toBeInTheDocument();
  });

  it('links the name to the page of the member, by the id the server sent', () => {
    renderList([member({ id: 'id-1' }), member({ id: 'id-2', fullName: 'Beto Ruiz' })]);

    expect(screen.getByRole('link', { name: 'Ana Perez' })).toHaveAttribute('href', '/admin/members/id-1');
    expect(screen.getByRole('link', { name: 'Beto Ruiz' })).toHaveAttribute('href', '/admin/members/id-2');
  });

  it('keeps the name and the email out of every address', () => {
    renderList([member({ id: 'id-1' })]);

    const { href } = screen.getByRole('link', { name: 'Ana Perez' });

    expect(href).not.toMatch(/ana/i);
    expect(href).not.toContain('example.test');
  });

  describe('the payment status', () => {
    it('shows an active member with the date they are paid until', () => {
      renderList([member({ isActive: true, paidUntil: '2026-10-31' })]);

      expect(within(rows()[0]).getByText('Activo')).toBeInTheDocument();
      expect(within(rows()[0]).getByText('Pagado hasta 31 de octubre de 2026')).toBeInTheDocument();
      expect(within(rows()[0]).queryByText('Inactivo')).not.toBeInTheDocument();
    });

    it('shows an inactive member with the date of the last due date', () => {
      renderList([member({ isActive: false, paidUntil: '2026-08-15' })]);

      expect(within(rows()[0]).getByText('Inactivo')).toBeInTheDocument();
      expect(within(rows()[0]).getByText('Último vencimiento: 15 de agosto de 2026'))
        .toBeInTheDocument();
      expect(within(rows()[0]).queryByText('Activo')).not.toBeInTheDocument();
    });

    it('calls a member whose only period has not begun inactive, with the date it ends', () => {
      renderList([member({ isActive: false, paidUntil: '2026-12-31' })]);

      expect(within(rows()[0]).getByText('Inactivo')).toBeInTheDocument();
      expect(within(rows()[0]).getByText('Último vencimiento: 31 de diciembre de 2026'))
        .toBeInTheDocument();
    });

    it('says a member with no periods has no payments', () => {
      renderList([member({ isActive: false, paidUntil: null })]);

      expect(within(rows()[0]).getByText('Inactivo')).toBeInTheDocument();
      expect(within(rows()[0]).getByText('Sin pagos registrados')).toBeInTheDocument();
      expect(within(rows()[0]).queryByText(/Último vencimiento|Pagado hasta/)).not.toBeInTheDocument();
    });

    it('writes the first of a month without shifting it to the day before', () => {
      renderList([member({ paidUntil: '2026-03-01' })]);

      expect(within(rows()[0]).getByText('Pagado hasta 1 de marzo de 2026')).toBeInTheDocument();
    });
  });
});
