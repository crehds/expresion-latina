import { render, screen, within } from '@testing-library/react';

import AttendeeList from './AttendeeList';

// A confirmation as the adapter's admin read returns it.
const row = (overrides = {}) => ({
  memberId: 'm-1',
  fullName: 'Ana Perez',
  classDate: '2026-10-26',
  startTime: '19:00',
  endTime: '20:00',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
  ...overrides,
});

const group = (key, rows) => ({ key, rows });

const items = () => screen.getAllByRole('listitem');

describe('AttendeeList', () => {
  it('titles each class from the snapshot stored with the confirmations', () => {
    render(<AttendeeList groups={[group('a', [row()])]} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Salsa' })).toBeInTheDocument();
    expect(screen.getByText('26 de octubre de 2026 · 19:00 a 20:00 · Sala 1')).toBeInTheDocument();
  });

  it('counts the people of each class, in the singular and the plural', () => {
    render(
      <AttendeeList
        groups={[
          group('a', [row({ memberId: 'm-1' })]),
          group('b', [row({ memberId: 'm-2' }), row({ memberId: 'm-3', fullName: 'Beto Ruiz' })]),
        ]}
      />,
    );

    expect(screen.getByText('1 persona')).toBeInTheDocument();
    expect(screen.getByText('2 personas')).toBeInTheDocument();
  });

  it('lists the names of a class sorted, whatever the order they came in', () => {
    render(
      <AttendeeList
        groups={[group('a', [
          row({ memberId: 'm-1', fullName: 'Luis Soto' }),
          row({ memberId: 'm-2', fullName: 'Ana Perez' }),
          row({ memberId: 'm-3', fullName: 'Álvaro Gil' }),
          row({ memberId: 'm-4', fullName: 'Beto Ruiz' }),
        ])]}
      />,
    );

    const names = within(screen.getByRole('list', { name: 'Salsa' })).getAllByRole('listitem');
    expect(names.map((item) => item.textContent)).toEqual([
      'Álvaro Gil', 'Ana Perez', 'Beto Ruiz', 'Luis Soto',
    ]);
  });

  it('keeps the classes in the order given, one block each', () => {
    render(
      <AttendeeList
        groups={[
          group('a', [row({ genreName: 'Bachata', startTime: '18:00', endTime: '19:00' })]),
          group('b', [row({ genreName: 'Salsa' })]),
        ]}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['Bachata', 'Salsa']);
  });

  it('words a member without a name neutrally and sorts it with the rest', () => {
    render(
      <AttendeeList
        groups={[group('a', [
          row({ memberId: 'm-1', fullName: null }),
          row({ memberId: 'm-2', fullName: 'Ana Perez' }),
        ])]}
      />,
    );

    expect(within(screen.getByRole('list', { name: 'Salsa' })).getAllByRole('listitem')
      .map((item) => item.textContent)).toEqual(['Ana Perez', 'Miembro sin nombre']);
  });

  it('lists two people with the same name', () => {
    render(
      <AttendeeList
        groups={[group('a', [
          row({ memberId: 'm-1', fullName: 'Ana Perez' }),
          row({ memberId: 'm-2', fullName: 'Ana Perez' }),
        ])]}
      />,
    );

    expect(screen.getAllByText('Ana Perez')).toHaveLength(2);
    expect(screen.getByText('2 personas')).toBeInTheDocument();
  });

  it('keeps the class when its stored date cannot be written', () => {
    render(<AttendeeList groups={[group('a', [row({ classDate: 'not-a-date' })])]} />);

    expect(screen.getByText('Fecha no disponible · 19:00 a 20:00 · Sala 1')).toBeInTheDocument();
    expect(screen.queryByText(/not-a-date/)).not.toBeInTheDocument();
  });

  it('shows nothing of the member but the name', () => {
    render(
      <AttendeeList
        groups={[group('a', [row({ memberId: 'secret-id', email: 'ana@example.test' })])]}
      />,
    );

    expect(screen.queryByText(/secret-id|ana@example\.test/)).not.toBeInTheDocument();
    expect(items().length).toBeGreaterThan(0);
  });

  it('renders nothing for a class with no confirmation, and never throws', () => {
    render(<AttendeeList groups={[group('a', []), group('b', [row({ genreName: 'Bachata' })])]} />);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual(['Bachata']);
    expect(screen.getByText('1 persona')).toBeInTheDocument();
  });

  it('renders no list at all for no class', () => {
    render(<AttendeeList groups={[]} />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
