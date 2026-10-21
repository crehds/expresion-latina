import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

import DayAgenda from './DayAgenda';

const DAY = { id: 'lun', name: 'Lunes', weekday: 1 };

const sessionOf = (id, genreName, start) => ({
  id,
  genre: { name: genreName },
  slot: { start, end: '20:00' },
  teacher: null,
  level: null,
  note: null,
});

const SESSIONS = [sessionOf('lun-1800', 'Salsa', '18:00'), sessionOf('lun-1900', 'Bachata', '19:00')];

const renderAgenda = (props = {}) => render(
  createElement(DayAgenda, { day: DAY, sessions: SESSIONS, ...props }),
  { wrapper: MemoryRouter },
);

describe('DayAgenda', () => {
  it('asks for the action of each session and puts it inside that session\'s card', () => {
    const renderSessionAction = vi.fn((session) => (
      <button type="button">{`Acción ${session.id}`}</button>
    ));

    renderAgenda({ renderSessionAction });

    expect(renderSessionAction).toHaveBeenCalledTimes(2);
    expect(renderSessionAction).toHaveBeenCalledWith(SESSIONS[0]);
    expect(renderSessionAction).toHaveBeenCalledWith(SESSIONS[1]);
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByRole('button', { name: 'Acción lun-1800' })).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: 'Acción lun-1900' })).toBeInTheDocument();
  });

  it('renders the same markup with an action that renders nothing as with none', () => {
    const bare = renderAgenda();
    const bareHtml = bare.container.innerHTML;
    bare.unmount();

    const silent = renderAgenda({ renderSessionAction: () => null });

    expect(silent.container.innerHTML).toBe(bareHtml);
  });

  it('does not ask for an action on a day with no classes', () => {
    const renderSessionAction = vi.fn();

    renderAgenda({ sessions: [], renderSessionAction });

    expect(renderSessionAction).not.toHaveBeenCalled();
    expect(screen.getByText(/No hay clases los lunes/)).toBeInTheDocument();
  });
});
