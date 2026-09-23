import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from '../../App';

/*
 * Without a route of its own, an address nobody recognises rendered the nav
 * and the footer with nothing between them — a page that looks broken rather
 * than one that says what happened.
 *
 * /reviews is the case that made this real rather than hypothetical: that
 * page existed until opinions moved onto the landing page, so the address can
 * still be sitting in somebody's bookmarks or in a search result.
 */
function renderAt(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe('an address the site does not have', () => {
  it.each(['/reviews', '/cualquier-cosa', '/teachers/nadie/extra'])(
    'says so at %s rather than rendering nothing',
    async (route) => {
      renderAt(route);

      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    },
  );

  /*
   * Scoped to the page itself. The header's logo is also a link home, so an
   * unscoped query passes on a page that offers nothing of its own.
   */
  it('offers the way back on the page, not only in the header', async () => {
    renderAt('/reviews');

    const page = within(await screen.findByRole('main'));

    expect(page.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/');
  });

  /*
   * The half that is easy to lose: a catch-all wide enough to swallow the
   * real routes would pass the tests above while taking the site down.
   */
  it('leaves the real pages alone', async () => {
    renderAt('/schedules');

    expect(await screen.findByRole('heading', { level: 1, name: 'Horarios' })).toBeInTheDocument();
  });
});
