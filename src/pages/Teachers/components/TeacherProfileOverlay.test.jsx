import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Link, MemoryRouter, useLocation, useNavigate,
} from 'react-router-dom';

import TeacherProfileOverlay, { teacherProfileLink } from './TeacherProfileOverlay';

const TEACHER = { id: 'mishel-fernandez', name: 'Mishel Fernández' };
const linkFor = teacherProfileLink('/somewhere');

// Shows where the router is, so a test can say what the address is after a click
// without reaching into the router itself.
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{`${pathname}${search}`}</output>;
}

function ForwardButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(1)}>Adelante</button>;
}

function Host() {
  const { to, state } = linkFor(TEACHER);
  return (
    <>
      <Link to={to} state={state}>Abrir</Link>
      <TeacherProfileOverlay />
      <LocationProbe />
      <ForwardButton />
    </>
  );
}

const renderAt = (...entries) => render(
  <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
    <Host />
  </MemoryRouter>,
);

const currentAddress = () => screen.getByTestId('location').textContent;

describe('the link a page builds for a teacher', () => {
  it('points back at that page with the teacher in the address', () => {
    expect(linkFor(TEACHER).to).toBe('/somewhere?teacher=mishel-fernandez');
  });

  it('encodes an id that is not address-safe', () => {
    expect(linkFor({ id: 'a b&c' }).to).toBe('/somewhere?teacher=a%20b%26c');
  });

  it('marks the visit as opened here', () => {
    expect(linkFor(TEACHER).state).toEqual({ openedHere: true });
  });
});

describe('TeacherProfileOverlay', () => {
  it('opens the teacher named in the address', () => {
    renderAt('/somewhere?teacher=mishel-fernandez');

    expect(screen.getByRole('dialog', { name: 'Mishel Fernández' })).toBeInTheDocument();
  });

  it('renders nothing when the address names no teacher', () => {
    renderAt('/somewhere');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing for an id nobody has', () => {
    renderAt('/somewhere?teacher=nobody-by-that-name');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes a link it did not open in place, keeping any other parameter', async () => {
    const user = userEvent.setup();
    renderAt('/somewhere?teacher=mishel-fernandez&utm=flyer');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/somewhere?utm=flyer');
  });

  it('closes a profile opened from a link by going back one entry', async () => {
    const user = userEvent.setup();
    renderAt('/somewhere');

    await user.click(screen.getByRole('link', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentAddress()).toBe('/somewhere');
  });

  describe('closing a profile opened here', () => {
    const OPENED = {
      pathname: '/somewhere',
      search: '?teacher=mishel-fernandez',
      state: { openedHere: true },
    };

    // Both closes land before React commits the first one, which is what a double
    // click does while the browser is still working through the first step back.
    it('goes back one entry only on a double close', () => {
      renderAt('/', '/somewhere', OPENED);

      act(() => {
        const close = screen.getByRole('button', { name: 'Cerrar' });
        close.click();
        close.click();
      });

      expect(currentAddress()).toBe('/somewhere');
    });

    it('still goes back when the same entry is reopened with forward and closed again', async () => {
      const user = userEvent.setup();
      renderAt('/', '/somewhere', OPENED);

      await user.click(screen.getByRole('button', { name: 'Cerrar' }));
      expect(currentAddress()).toBe('/somewhere');
      await user.click(screen.getByRole('button', { name: 'Adelante' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(currentAddress()).toBe('/somewhere');
    });
  });
});
