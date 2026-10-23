import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

import Home from './Home';
import getPosters from './services/posters';

vi.mock('./services/posters', () => ({ default: vi.fn() }));

// A Tuesday, so the today strip has classes on it.
const TUESDAY = new Date('2025-10-07T12:00:00');

beforeEach(() => {
  // Only the clock is faked. Faking timers as well would hang userEvent.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
  getPosters.mockReset();
  getPosters.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// Shows where the router is, so a test can say what the address is after a click
// without reaching into the router itself.
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{`${pathname}${search}`}</output>;
}

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Home />
    <LocationProbe />
  </MemoryRouter>,
);

const currentAddress = () => screen.getByTestId('location').textContent;

const strip = () => screen.getByRole('region', { name: 'Hoy, martes' });
const firstTeacherLink = () => within(within(strip()).getAllByRole('article')[0]).getByRole('link');

describe('Home opening a teacher over the page', () => {
  it('opens the teacher of a strip class in a dialog and keeps Home on screen', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const link = firstTeacherLink();
    const name = link.textContent;

    await user.click(link);

    expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novedades' })).toBeInTheDocument();
    expect(currentAddress()).toMatch(/^\/\?teacher=[\w-]+$/);
  });

  it('closes by going back to Home without the teacher', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(firstTeacherLink());
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/');
  });

  it('opens a profile reached by a direct link and closes it on Home', async () => {
    const user = userEvent.setup();
    renderAt('/?teacher=mishel-fernandez');

    expect(screen.getByRole('dialog', { name: 'Mishel Fernández' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/');
  });

  it('shows Home and no dialog for an id nobody has', () => {
    renderAt('/?teacher=nobody-by-that-name');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novedades' })).toBeInTheDocument();
  });

  // Home is the same route with or without the search, so it is not rebuilt: the
  // posters are not fetched again and the page keeps its place.
  it('does not rebuild Home when the profile opens and closes', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const heading = screen.getByRole('heading', { name: 'Novedades' });

    await user.click(firstTeacherLink());
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(getPosters).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Novedades' })).toBe(heading);
  });
});
