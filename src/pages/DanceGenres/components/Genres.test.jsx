import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Genres from './Genres';

const SALSA = { id: 'salsa', name: 'Salsa', slug: 'salsa' };
const JAZZ = { id: 'jazz', name: 'Jazz', slug: 'jazz' };

/*
 * Which genres count as scheduled is the selector's question and is tested
 * where it lives. Stubbing it here keeps this file about what the page does
 * with the answer, and off the published academy.json — that file is an output
 * of the importer, so binding a page test to it makes the test fail the next
 * time the academy edits a spreadsheet.
 */
const scheduledIds = new Set();

vi.mock('../../../data/selectors', () => ({
  getActiveTeachersByGenreId: () => [],
  groupGenresBySchedule: (list) => ({
    scheduled: list.filter((genre) => scheduledIds.has(genre.id)),
    upcoming: list.filter((genre) => !scheduledIds.has(genre.id)),
  }),
}));

function renderGenres(danceGenres, scheduled = []) {
  scheduledIds.clear();
  scheduled.forEach((id) => scheduledIds.add(id));

  return render(<Genres danceGenres={danceGenres} />, { wrapper: MemoryRouter });
}

const shownNames = () => screen.getAllByRole('listitem').map((item) => item.textContent);

describe('a page with both scheduled and unscheduled genres', () => {
  beforeEach(() => renderGenres([JAZZ, SALSA], ['salsa']));

  it('shows the genre that has classes first', () => {
    const shown = shownNames();

    expect(shown.indexOf('Salsa')).toBeLessThan(shown.indexOf('Jazz'));
  });

  it('keeps the genre with no schedule on the page', () => {
    expect(screen.getByText('Jazz')).toBeInTheDocument();
  });

  it('labels both groups so the difference is visible', () => {
    expect(screen.getByRole('heading', { name: 'En horario' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Próximamente' })).toBeInTheDocument();
  });

  it('says what próximamente means rather than leaving it to be guessed', () => {
    expect(screen.getByText(/Todavía no tienen horario publicado/)).toBeInTheDocument();
  });
});

/*
 * One group alone needs no label: there is nothing to tell it apart from, and a
 * heading over the only list on the page is furniture.
 */
describe('a page where every genre is running', () => {
  beforeEach(() => renderGenres([SALSA, JAZZ], ['salsa', 'jazz']));

  it('shows both genres', () => {
    expect(shownNames()).toEqual(['Salsa', 'Jazz']);
  });

  it('drops the headings', () => {
    expect(screen.queryByRole('heading', { name: 'En horario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Próximamente' })).not.toBeInTheDocument();
  });
});

describe('a page where nothing is scheduled yet', () => {
  beforeEach(() => renderGenres([SALSA, JAZZ], []));

  it('still lists every genre rather than rendering an empty page', () => {
    expect(shownNames()).toEqual(['Salsa', 'Jazz']);
  });

  it('drops the headings, there being only one group', () => {
    expect(screen.queryByRole('heading', { name: 'Próximamente' })).not.toBeInTheDocument();
  });

  it('still explains why none of them have an hour', () => {
    expect(screen.getByText(/Todavía no tienen horario publicado/)).toBeInTheDocument();
  });
});
