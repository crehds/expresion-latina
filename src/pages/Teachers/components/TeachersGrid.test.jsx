import { render, screen } from '@testing-library/react';

import TeachersGrid from './TeachersGrid';

/*
 * The grid used to list the whole faculty under two headings. It now lists
 * only whoever the schedule names this month, which means the filter can make
 * a real teacher disappear from the site. That is the regression worth
 * catching, and the page test cannot: it renders one profile by id and passes
 * identically whether this grid shows everyone, the subset, or nothing.
 */
const TEACHING = { id: 'mishel', name: 'Mishel Fernández', initials: 'MF' };
const LEFT = { id: 'izquierdo', name: 'Izquierdo', initials: 'IZ' };

function renderGrid(activeIds) {
  return render(
    <TeachersGrid
      teachers={[TEACHING, LEFT]}
      activeIds={new Set(activeIds)}
      showProfile={() => {}}
    />,
  );
}

describe('the faculty grid', () => {
  it('shows a teacher the schedule names this month', () => {
    renderGrid(['mishel']);

    expect(screen.getByText('Mishel Fernández')).toBeInTheDocument();
  });

  it('leaves out a teacher the schedule no longer names', () => {
    renderGrid(['mishel']);

    expect(screen.queryByText('Izquierdo')).not.toBeInTheDocument();
  });

  it('keeps everyone the schedule still names', () => {
    renderGrid(['mishel', 'izquierdo']);

    expect(screen.getByText('Mishel Fernández')).toBeInTheDocument();
    expect(screen.getByText('Izquierdo')).toBeInTheDocument();
  });

  /*
   * A month whose schedule is not published yet empties the filter. Rendering
   * nothing at all would read as a page that failed rather than one that is
   * waiting.
   */
  it('says the month is not published rather than rendering an empty page', () => {
    renderGrid([]);

    expect(screen.getByText(/Todavía no publicamos/)).toBeInTheDocument();
    expect(screen.queryByText('Mishel Fernández')).not.toBeInTheDocument();
  });
});
