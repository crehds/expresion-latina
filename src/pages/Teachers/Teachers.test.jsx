import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Teachers from './Teachers';

/*
 * No matchMedia setup here any more. The page used to read it on construction
 * to choose between a grid and a phone-only carousel; the carousel is gone and
 * one grid serves every width, so a mock claiming the page is viewport
 * sensitive would only tell a future reader something untrue.
 */
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/teachers" element={<Teachers />} />
      <Route path="/teachers/:teacherId" element={<Teachers />} />
    </Routes>
  </MemoryRouter>,
);

describe('a teacher profile', () => {
  // This is what makes the link from a class in the schedule work at all, and
  // what lets a visitor send one teacher to a friend.
  it('opens from its own url', () => {
    renderAt('/teachers/omar-lopez');

    expect(screen.getByRole('heading', { name: 'Omar López' })).toBeInTheDocument();
  });

  /*
   * This case used to render the faculty route, where no panel was ever open,
   * and assert the close button was absent — true before any close happens,
   * and the same assertion the unknown-id case below makes. It closes a panel
   * now, which is the transition the page actually owns: the panel reports the
   * press, and the page turns that into a navigation back to the faculty.
   */
  it('closes back to the faculty', async () => {
    renderAt('/teachers/omar-lopez');

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Omar López' })).not.toBeInTheDocument();
  });

  it('leaves the faculty reachable behind the panel', () => {
    renderAt('/teachers/omar-lopez');

    expect(screen.getByRole('heading', { name: 'Profesores' })).toBeInTheDocument();
  });

  // A link saved from an older schedule should land on the faculty, not on an
  // empty modal.
  it('falls back to the faculty when the id is unknown', () => {
    renderAt('/teachers/nobody');

    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });
});
