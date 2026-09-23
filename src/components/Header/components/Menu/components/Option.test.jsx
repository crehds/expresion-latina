import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Option from './Option';

/*
 * The menu entries are flat — /teachers, /dances — but App routes them as
 * /teachers/:teacherId and /dances/*, so the pathname a visitor is actually on
 * is usually longer than the entry that should be lit. location is passed in
 * rather than driven through a router: which pathname is current is the
 * router's business, and what the entry does with it is this component's.
 */
function renderOption(pathname, path = '/teachers', name = 'Profesores') {
  return render(
    <MemoryRouter>
      <ul>
        <Option name={name} path={path} location={{ pathname }} onNavigate={() => {}} />
      </ul>
    </MemoryRouter>,
  );
}

const link = (name = 'Profesores') => screen.getByRole('link', { name });

describe('the entry for the page you are on', () => {
  it('is marked on the entry\'s own path', () => {
    renderOption('/teachers');

    expect(link()).toHaveAttribute('aria-current', 'page');
  });

  // Reachable in one click: SessionCard links a class straight to its teacher.
  it('stays marked on a child route', () => {
    renderOption('/teachers/mishel-fernandez');

    expect(link()).toHaveAttribute('aria-current', 'page');
  });

  it('stays marked deeper than one segment', () => {
    renderOption('/dances/salsa/videos', '/dances', 'Clases');

    expect(link('Clases')).toHaveAttribute('aria-current', 'page');
  });

  it('carries the active class alongside aria-current', () => {
    renderOption('/teachers/mishel-fernandez');

    expect(link()).toHaveClass('option__link--active');
  });
});

describe('the entries for pages you are not on', () => {
  it('is not marked on an unrelated route', () => {
    renderOption('/schedules');

    expect(link()).not.toHaveAttribute('aria-current');
  });

  /*
   * A prefix is not an ancestor. Matching on the raw string would light
   * Profesores on a route that merely starts with the same letters, so the
   * comparison has to land on a segment boundary.
   */
  it('is not marked on a route that only shares its prefix', () => {
    renderOption('/teachers-invitados');

    expect(link()).not.toHaveAttribute('aria-current');
  });

  /*
   * Inicio is the one entry whose path is a prefix of every other, so it is
   * the case a segment-boundary rule has to special-case rather than discover.
   */
  it('does not light Inicio on every page of the site', () => {
    renderOption('/teachers/mishel-fernandez', '/', 'Inicio');

    expect(link('Inicio')).not.toHaveAttribute('aria-current');
  });

  it('still lights Inicio at the site root', () => {
    renderOption('/', '/', 'Inicio');

    expect(link('Inicio')).toHaveAttribute('aria-current', 'page');
  });
});
