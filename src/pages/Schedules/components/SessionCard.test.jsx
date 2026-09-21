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
