import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Teachers from './Teachers';

// jsdom implements no matchMedia, and the page reads it on construction.
function mockViewport(isWide) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isWide,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/teachers" element={<Teachers />} />
      <Route path="/teachers/:teacherId" element={<Teachers />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => mockViewport(true));

describe('a teacher profile', () => {
  // This is what makes the link from a class in the schedule work at all, and
  // what lets a visitor send one teacher to a friend.
  it('opens from its own url', () => {
    renderAt('/teachers/omar-lopez');

    expect(screen.getByRole('heading', { name: 'Omar López' })).toBeInTheDocument();
  });

  it('closes back to the faculty', () => {
    renderAt('/teachers');

    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });

  // A link saved from an older schedule should land on the faculty, not on an
  // empty modal.
  it('falls back to the faculty when the id is unknown', () => {
    renderAt('/teachers/nobody');

    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });
});
