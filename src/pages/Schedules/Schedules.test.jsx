import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Schedules from './Schedules';

// Session cards link to a teacher's profile, so the page needs a router even
// though nothing in these tests navigates.
const renderSchedules = () => render(<Schedules />, { wrapper: MemoryRouter });

// jsdom implements no matchMedia at all, so the page would throw on construction.
// This also lets each test pick the viewport it is about.
function mockViewport(isWide) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isWide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

// A Tuesday, so "today" is a day the academy teaches.
const TUESDAY = new Date('2025-10-07T12:00:00');

beforeEach(() => {
  // Only the clock is faked. Faking timers as well would hang userEvent,
  // which waits on real ones.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Schedules on a narrow screen', () => {
  beforeEach(() => mockViewport(false));

  it('offers only the days the academy teaches', () => {
    renderSchedules();

    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((day) => {
      expect(screen.getByRole('button', { name: day })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Sábado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Domingo' })).not.toBeInTheDocument();
  });

  it('starts on today', () => {
    renderSchedules();

    expect(screen.getByRole('button', { name: 'Martes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lunes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("shows today's classes, earliest first", () => {
    renderSchedules();

    const times = screen.getAllByRole('article').map((card) => card.textContent);

    expect(times).toHaveLength(3);
    expect(times[0]).toContain('Sexy Style');
    expect(times[2]).toContain('Bachata');
  });

  it('swaps the list when another day is chosen', async () => {
    const user = userEvent.setup();
    renderSchedules();

    await user.click(screen.getByRole('button', { name: 'Viernes' }));

    expect(screen.getByRole('button', { name: 'Viernes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Reggaeton')).toBeInTheDocument();
    expect(screen.queryByText('Sexy Style')).not.toBeInTheDocument();
  });

  it('shows one day at a time, not the whole week', () => {
    renderSchedules();

    expect(screen.queryByText('Reggaeton')).not.toBeInTheDocument();
  });
});

describe('Schedules on a wide screen', () => {
  beforeEach(() => mockViewport(true));

  it('shows every teaching day as its own column', () => {
    renderSchedules();

    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((day) => {
      expect(screen.getByRole('heading', { name: new RegExp(`^${day}`) })).toBeInTheDocument();
    });
  });

  it('shows the whole week at once', () => {
    renderSchedules();

    expect(screen.getByText('Reggaeton')).toBeInTheDocument();
    expect(screen.getAllByText('Bachata')).toHaveLength(2);
  });

  it('offers no day picker', () => {
    renderSchedules();

    expect(screen.queryByRole('group', { name: 'Elegir día' })).not.toBeInTheDocument();
  });

  // The flyer's two ninety-minute Monday classes and its lone Friday morning
  // class are exactly what a shared-row grid could not hold.
  it('keeps each day independent of the others', () => {
    renderSchedules();

    const friday = screen.getByRole('region', { name: 'Viernes' });

    expect(friday).toHaveTextContent('10:00');
    expect(friday).toHaveTextContent('Heels');
  });
});

// The reason the schedule and the faculty share a data model: reading one
// should take you to the other.
describe('a class with a teacher', () => {
  it('links the name to that teacher profile', () => {
    mockViewport(false);
    renderSchedules();

    const [link] = screen.getAllByRole('link');

    expect(link.getAttribute('href')).toMatch(/^\/teachers\/[a-z-]+$/);
  });
});
