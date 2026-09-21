import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Hero from './Hero';

vi.mock('../../../data', () => ({
  studio: {
    name: 'Expresión Latina', address: null, city: null, whatsapp: null,
  },
  classGenres: [{ id: 'salsa', name: 'Salsa' }],
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
