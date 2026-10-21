import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

import WeekColumns from './WeekColumns';

const DAYS = [
  { id: 'lun', name: 'Lunes', weekday: 1 },
  { id: 'mar', name: 'Martes', weekday: 2 },
];

const sessionOf = (id, genreName) => ({
  id,
  genre: { name: genreName },
  slot: { start: '19:00', end: '20:00' },
  teacher: null,
  level: null,
  note: null,
});

const BY_WEEKDAY = {
  1: [sessionOf('lun-1900', 'Salsa')],
  2: [sessionOf('mar-1900', 'Bachata')],
};

const renderColumns = (props = {}) => render(
  createElement(WeekColumns, {
    days: DAYS,
    sessionsByWeekday: (weekday) => BY_WEEKDAY[weekday],
    currentWeekday: 1,
    ...props,
  }),
  { wrapper: MemoryRouter },
);

describe('WeekColumns', () => {
  it('passes the action of each session down to its card, in its own column', () => {
    const renderSessionAction = vi.fn((session) => (
      <button type="button">{`Acción ${session.id}`}</button>
    ));

    renderColumns({ renderSessionAction });

    expect(renderSessionAction).toHaveBeenCalledTimes(2);
    expect(within(screen.getByRole('region', { name: 'Lunes' }))
      .getByRole('button', { name: 'Acción lun-1900' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Martes' }))
      .getByRole('button', { name: 'Acción mar-1900' })).toBeInTheDocument();
  });

  it('renders the same markup with an action that renders nothing as with none', () => {
    const bare = renderColumns();
    const bareHtml = bare.container.innerHTML;
    bare.unmount();

    const silent = renderColumns({ renderSessionAction: () => null });

    expect(silent.container.innerHTML).toBe(bareHtml);
  });
});
