import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import TodayStrip from './TodayStrip';

// A Tuesday, so "today" is a day the academy teaches.
const TUESDAY = new Date('2025-10-07T12:00:00');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TodayStrip', () => {
  it("lists today's classes", () => {
    render(<TodayStrip />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { name: 'Hoy, martes' })).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('points each teacher at the home page with that teacher in the address', () => {
    render(<TodayStrip />, { wrapper: MemoryRouter });

    screen.getAllByRole('article').forEach((card) => {
      const link = within(card).getByRole('link');
      expect(link.getAttribute('href')).toMatch(/^\/\?teacher=[\w-]+$/);
    });
  });
});
