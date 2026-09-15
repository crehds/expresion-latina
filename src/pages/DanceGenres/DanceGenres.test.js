import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import DanceGenres from './DanceGenres';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dances/*" element={<DanceGenres />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DanceGenres', () => {
  it('lists every genre', () => {
    renderAt('/dances');

    expect(screen.getByText('Salsa')).toBeInTheDocument();
    expect(screen.getByText('Latin Urban')).toBeInTheDocument();
  });

  // The genre used to be addressed by display name, so "Latin Urban" reached
  // the route percent-encoded and resolved to nothing.
  it('links to a genre by slug, not by display name', () => {
    renderAt('/dances');

    expect(screen.getByText('Latin Urban').closest('a'))
      .toHaveAttribute('href', '/dances/latin-urban/videos');
  });

  describe('the videos of a genre', () => {
    // Guards the route parameter name against the component that reads it.
    it('resolves the slug in the url and shows the genre name', () => {
      renderAt('/dances/latin-urban/videos');

      expect(screen.getByRole('heading', { name: 'Latin Urban' })).toBeInTheDocument();
    });

    it('says so when a genre has no videos yet', () => {
      renderAt('/dances/salsa/videos');

      expect(screen.getByText(/Todavía no hay videos/)).toBeInTheDocument();
    });

    it('shows the videos a genre does have', () => {
      const { container } = renderAt('/dances/ladies/videos');

      expect(container.querySelectorAll('video')).toHaveLength(1);
      expect(screen.queryByText(/Todavía no hay videos/)).not.toBeInTheDocument();
    });

    it('does not pretend an unknown genre exists', () => {
      renderAt('/dances/tango/videos');

      expect(screen.getByRole('heading', { name: /no encontrado/i })).toBeInTheDocument();
    });
  });
});
