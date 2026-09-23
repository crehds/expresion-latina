import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Hero from './Hero';

vi.mock('../../../data', () => ({
  studio: {
    name: 'Expresión Latina', address: null, city: null, whatsapp: null,
  },
  // Derived from studio.whatsapp, so a studio without a number has no link.
  whatsappLink: null,
  classGenres: [
    { id: 'jazz', name: 'Jazz' },
    { id: 'salsa', name: 'Salsa' },
  ],
}));

/*
 * Stubbed rather than run for real: selectors builds its views from the data
 * module at import time, and that module is mocked here down to what Hero
 * needs. Which genres count as scheduled is the selector's own question and is
 * tested where it lives — this only pins that Hero renders them in the order it
 * is handed.
 */
vi.mock('../../../data/selectors', () => ({
  groupGenresBySchedule: (list) => ({
    scheduled: list.filter((genre) => genre.id === 'salsa'),
    upcoming: list.filter((genre) => genre.id !== 'salsa'),
  }),
}));

/*
 * The schema makes address, city and whatsapp optional, so a published
 * academy.json is allowed to omit them. Hero is the first thing the landing
 * page renders, so a throw here is a blank site rather than a missing button.
 */
describe('a studio with no contact details', () => {
  beforeEach(() => render(<Hero />, { wrapper: MemoryRouter }));

  it('still renders', () => {
    expect(screen.getByRole('heading', { name: 'Expresión Latina' })).toBeInTheDocument();
  });

  it('keeps the schedule link', () => {
    expect(screen.getByRole('link', { name: 'Ver horarios' })).toBeInTheDocument();
  });

  it('drops the whatsapp button rather than linking nowhere', () => {
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });
});

/*
 * Eight of sixteen genres fit on the landing page, so which eight is a real
 * choice. Advertising a style with no hour while cutting one that runs twice a
 * week sends a visitor to a class that does not exist.
 */
describe('the genres the landing page advertises', () => {
  beforeEach(() => render(<Hero />, { wrapper: MemoryRouter }));

  it('puts a genre that has classes before one that has none', () => {
    const shown = screen.getAllByRole('listitem').map((item) => item.textContent);

    expect(shown.indexOf('Salsa')).toBeLessThan(shown.indexOf('Jazz'));
  });

  it('still advertises the genre with no schedule rather than hiding it', () => {
    expect(screen.getByText('Jazz')).toBeInTheDocument();
  });
});
