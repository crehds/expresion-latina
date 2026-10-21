import { render, screen, within } from '@testing-library/react';

import MismatchList from './MismatchList';

const row = (overrides = {}) => ({
  memberId: 'm-1',
  fullName: 'Ana Perez',
  classDate: '2026-10-28',
  startTime: '23:30',
  endTime: '00:30',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
  ...overrides,
});

describe('MismatchList', () => {
  it('has the title the spec fixes, as a level 3 heading of a region of its own', () => {
    render(<MismatchList rows={[row()]} />);

    const region = screen.getByRole('region', { name: 'Ya no coincide con el horario' });
    expect(within(region).getByRole('heading', { level: 3, name: 'Ya no coincide con el horario' }))
      .toBeInTheDocument();
  });

  it('shows each confirmation with its stored snapshot and the name of the member', () => {
    render(
      <MismatchList
        rows={[
          row(),
          row({
            memberId: 'm-2',
            fullName: 'Beto Ruiz',
            classDate: '2026-10-27',
            startTime: '18:00',
            endTime: '19:00',
            genreName: 'Bachata',
            roomLabel: 'Sala 2',
          }),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Ana Perez')).toBeInTheDocument();
    expect(within(items[0]).getByText('Salsa')).toBeInTheDocument();
    expect(within(items[0]).getByText('28 de octubre de 2026 · 23:30 a 00:30 · Sala 1')).toBeInTheDocument();
    expect(within(items[1]).getByText('Beto Ruiz')).toBeInTheDocument();
    expect(within(items[1]).getByText('Bachata')).toBeInTheDocument();
    expect(within(items[1]).getByText('27 de octubre de 2026 · 18:00 a 19:00 · Sala 2')).toBeInTheDocument();
  });

  it('words a member without a name neutrally', () => {
    render(<MismatchList rows={[row({ fullName: null })]} />);

    expect(screen.getByText('Miembro sin nombre')).toBeInTheDocument();
  });

  it('keeps the row when its stored date cannot be written', () => {
    render(<MismatchList rows={[row({ classDate: '2026-02-30' })]} />);

    expect(screen.getByText('Fecha no disponible · 23:30 a 00:30 · Sala 1')).toBeInTheDocument();
  });

  it('renders nothing when there is nothing that stopped matching', () => {
    const { container } = render(<MismatchList rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
