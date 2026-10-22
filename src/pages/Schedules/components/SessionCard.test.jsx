import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SessionCard from './SessionCard';

/*
 * The link from a class to the person teaching it is the point of the shared
 * data model, so it is worth a test that cannot drift.
 *
 * This is that test at the level the behaviour lives at. Asserting it through
 * the schedule page meant reaching into the published file for a weekday that
 * happened to name a teacher, and resolving the link by that teacher's name —
 * which throws the moment one of them holds two classes that day. Both are
 * data-only failures in a case about markup.
 */
const session = (overrides = {}) => ({
  id: 's1',
  genre: { name: 'Salsa' },
  slot: { start: '19:00', end: '20:30' },
  teacher: { id: 'mishel-fernandez', name: 'Mishel Fernández' },
  level: null,
  note: null,
  ...overrides,
});

const renderCard = (props) => render(
  <SessionCard session={session(props)} />,
  { wrapper: MemoryRouter },
);

describe('a class card', () => {
  it('links the teacher name to that teacher profile', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Mishel Fernández' }))
      .toHaveAttribute('href', '/teachers/mishel-fernandez');
  });

  it('links to the teacher it names, not to another', () => {
    renderCard({ teacher: { id: 'kenneth-ocana', name: 'Kenneth Ocaña' } });

    const link = screen.getByRole('link');

    expect(link).toHaveTextContent('Kenneth Ocaña');
    expect(link).toHaveAttribute('href', '/teachers/kenneth-ocana');
  });

  /*
   * A slug may carry digits per the schema, and an earlier version of this
   * assertion matched the href against a pattern that excluded them.
   */
  it('accepts a slug with a digit in it', () => {
    renderCard({ teacher: { id: 'salsa-2', name: 'Salsa 2' } });

    expect(screen.getByRole('link', { name: 'Salsa 2' }))
      .toHaveAttribute('href', '/teachers/salsa-2');
  });

  it('carries no teacher link when the class has no teacher named', () => {
    renderCard({ teacher: null });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('still shows the class when nobody is named for it', () => {
    renderCard({ teacher: null });

    expect(screen.getByRole('heading', { name: 'Salsa' })).toBeInTheDocument();
  });
});

/*
 * The same teacher twice in one day is ordinary — it is why resolving the link
 * by the teacher's name across a whole page was the wrong query.
 */
describe('two classes with the same teacher', () => {
  it('gives each card its own link to that teacher', () => {
    render(
      <ol>
        <li><SessionCard session={session({ id: 's1' })} /></li>
        <li><SessionCard session={session({ id: 's2', genre: { name: 'Bachata' } })} /></li>
      </ol>,
      { wrapper: MemoryRouter },
    );

    const cards = screen.getAllByRole('article');

    expect(cards).toHaveLength(2);
    cards.forEach((card) => {
      expect(within(card).getByRole('link', { name: 'Mishel Fernández' }))
        .toHaveAttribute('href', '/teachers/mishel-fernandez');
    });
  });
});

/*
 * The time is what a visitor scans the schedule for (owner: "resaltar un poco la
 * hora de las cards de horario"), so it is set apart from the lines of detail: it
 * has the size of body text, one step above them, and the stylesheet gives it the
 * primary colour and a heavier weight. The markup stays what it was: one line with
 * the two times as real time elements.
 */
describe('the time of a class', () => {
  const timeLine = () => screen.getByText('–', { exact: false }).closest('p');

  it('is set apart from the details: a step larger, in its own class', () => {
    renderCard({ level: 'Básico' });

    expect(timeLine()).toHaveClass('session-card__time', 'text-md');
    expect(timeLine()).not.toHaveClass('text-sm');
    expect(screen.getByText(/Básico/).closest('p')).toHaveClass('text-sm');
  });

  it('is still one line with both times as time elements', () => {
    renderCard();

    const times = Array.from(timeLine().querySelectorAll('time'));
    expect(times.map((time) => [time.textContent, time.getAttribute('datetime')]))
      .toEqual([['19:00', '19:00'], ['20:30', '20:30']]);
    expect(timeLine()).toHaveTextContent('19:00 – 20:30');
  });

  it('is drawn with no style attribute, because the CSP allows none', () => {
    const { container } = renderCard({ level: 'Básico', note: 'Nuevo curso' });

    expect(container.querySelector('[style]')).toBeNull();
  });
});

describe('a class card with an action', () => {
  it('renders the action as the last child of the card, with no wrapper', () => {
    render(
      <SessionCard session={session()} action={<button type="button">Hacer algo</button>} />,
      { wrapper: MemoryRouter },
    );

    const card = screen.getByRole('article');
    expect(card.lastElementChild).toBe(screen.getByRole('button', { name: 'Hacer algo' }));
  });

  it.each([undefined, null, false])('is the same markup as a card with no action for %s', (action) => {
    const bare = render(<SessionCard session={session()} />, { wrapper: MemoryRouter });
    const bareHtml = bare.container.innerHTML;
    bare.unmount();

    const withAction = render(
      <SessionCard session={session()} action={action} />,
      { wrapper: MemoryRouter },
    );

    expect(withAction.container.innerHTML).toBe(bareHtml);
  });
});
