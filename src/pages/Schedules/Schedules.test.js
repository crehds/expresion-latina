import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Schedules from './Schedules';

// jsdom implements no matchMedia at all, so the page would throw on construction.
// This also lets each test pick the viewport it is about.
function mockViewport(isWide) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: isWide,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
}

// A Tuesday, so "today" is a day the academy teaches.
const TUESDAY = new Date('2025-10-07T12:00:00');

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setTimeout'] }).setSystemTime(TUESDAY);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Schedules on a narrow screen', () => {
  beforeEach(() => mockViewport(false));

  it('offers only the days the academy teaches', () => {
    render(<Schedules />);

    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((day) => {
      expect(screen.getByRole('button', { name: day })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Sábado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Domingo' })).not.toBeInTheDocument();
  });

  it('starts on today', () => {
    render(<Schedules />);

    expect(screen.getByRole('button', { name: 'Martes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lunes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("shows today's classes, earliest first", () => {
    render(<Schedules />);

    const times = screen.getAllByRole('article').map((card) => card.textContent);

    expect(times).toHaveLength(3);
    expect(times[0]).toContain('Sexy Style');
    expect(times[2]).toContain('Bachata');
  });

  it('swaps the list when another day is chosen', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Schedules />);

    await user.click(screen.getByRole('button', { name: 'Viernes' }));

    expect(screen.getByRole('button', { name: 'Viernes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Reggaeton')).toBeInTheDocument();
    expect(screen.queryByText('Sexy Style')).not.toBeInTheDocument();
  });

  it('shows one day at a time, not the whole week', () => {
    render(<Schedules />);

    expect(screen.queryByText('Reggaeton')).not.toBeInTheDocument();
  });
});

describe('Schedules on a wide screen', () => {
  beforeEach(() => mockViewport(true));

  it('shows every teaching day as its own column', () => {
    render(<Schedules />);

    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((day) => {
      expect(screen.getByRole('heading', { name: new RegExp(`^${day}`) })).toBeInTheDocument();
    });
  });

  it('shows the whole week at once', () => {
    render(<Schedules />);

    expect(screen.getByText('Reggaeton')).toBeInTheDocument();
    expect(screen.getAllByText('Bachata')).toHaveLength(2);
  });

  it('offers no day picker', () => {
    render(<Schedules />);

    expect(screen.queryByRole('group', { name: 'Elegir día' })).not.toBeInTheDocument();
  });

  // The flyer's two ninety-minute Monday classes and its lone Friday morning
  // class are exactly what a shared-row grid could not hold.
  it('keeps each day independent of the others', () => {
    render(<Schedules />);

    const friday = screen.getByRole('region', { name: 'Viernes' });

    expect(friday).toHaveTextContent('10:00');
    expect(friday).toHaveTextContent('Heels');
  });
});
