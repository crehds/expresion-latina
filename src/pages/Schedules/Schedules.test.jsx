import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

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

// Shows where the router is, so a test can say what the address is after a click
// without reaching into the router itself.
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{`${pathname}${search}`}</output>;
}

const renderAt = (...entries) => render(
  <MemoryRouter initialEntries={entries}>
    <Schedules />
    <LocationProbe />
  </MemoryRouter>,
);

const currentAddress = () => screen.getByTestId('location').textContent;

// The first teacher link of the cards on screen: its text is the teacher's name and
// its href carries the id, so the test needs to know nothing about the data.
const firstTeacherLink = () => within(screen.getAllByRole('article')[0]).getByRole('link');

const teacherIdOf = (link) => new URL(link.href).searchParams.get('teacher');

describe('Schedules opening a teacher over the schedule', () => {
  beforeEach(() => mockViewport(false));

  it('points the teacher of each card at the schedule with the teacher in the address', () => {
    renderAt('/schedules');

    expect(firstTeacherLink().getAttribute('href')).toMatch(/^\/schedules\?teacher=[\w-]+$/);
  });

  it('opens that teacher in a dialog and keeps the schedule on screen', async () => {
    const user = userEvent.setup();
    renderAt('/schedules');
    const link = firstTeacherLink();
    const name = link.textContent;

    await user.click(link);

    expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Martes' })).toBeInTheDocument();
    expect(currentAddress()).toBe(`/schedules?teacher=${teacherIdOf(link)}`);
  });

  it('closes a profile opened from the schedule by going back, on the same day', async () => {
    const user = userEvent.setup();
    renderAt('/schedules');
    await user.click(screen.getByRole('button', { name: 'Viernes' }));
    const friday = screen.getByRole('button', { name: 'Viernes' });

    await user.click(firstTeacherLink());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/schedules');
    // The same element, not an equal one: the page was never rebuilt.
    expect(screen.getByRole('button', { name: 'Viernes' })).toBe(friday);
    expect(friday).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the day while the profile is open', async () => {
    const user = userEvent.setup();
    renderAt('/schedules');
    await user.click(screen.getByRole('button', { name: 'Viernes' }));

    await user.click(firstTeacherLink());

    expect(screen.getByRole('button', { name: 'Viernes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a profile reached by a direct link', () => {
    renderAt('/schedules?teacher=mishel-fernandez');

    expect(screen.getByRole('dialog', { name: 'Mishel Fernández' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Martes' })).toBeInTheDocument();
  });

  it('closes a direct link in place, without going back past the first entry', async () => {
    const user = userEvent.setup();
    renderAt('/schedules?teacher=mishel-fernandez');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/schedules');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderAt('/schedules?teacher=mishel-fernandez');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/schedules');
  });

  it('closes on the scrim', async () => {
    const user = userEvent.setup();
    renderAt('/schedules?teacher=mishel-fernandez');

    await user.click(screen.getByRole('button', { name: 'Cerrar perfil' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/schedules');
  });

  it('keeps any other search parameter when it closes a direct link', async () => {
    const user = userEvent.setup();
    renderAt('/schedules?teacher=mishel-fernandez&utm=flyer');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(currentAddress()).toBe('/schedules?utm=flyer');
  });

  it('shows the schedule and no dialog for an id nobody has', () => {
    renderAt('/schedules?teacher=nobody-by-that-name');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Martes' })).toBeInTheDocument();
  });
});

describe('Schedules opening a teacher on a wide screen', () => {
  beforeEach(() => mockViewport(true));

  it('opens the profile over the week', async () => {
    const user = userEvent.setup();
    renderAt('/schedules');
    const link = firstTeacherLink();

    await user.click(link);

    expect(screen.getByRole('dialog', { name: link.textContent })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Viernes' })).toBeInTheDocument();
  });
});
