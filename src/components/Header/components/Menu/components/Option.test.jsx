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
function renderOption(pathname, path = '/teachers', name = 'Profesores', activePath = undefined) {
  return render(
    <MemoryRouter>
      <ul>
        <Option
          name={name}
          path={path}
          activePath={activePath}
          location={{ pathname }}
          onNavigate={() => {}}
        />
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

/*
 * An entry can link to the first of several pages (Admin goes to the members)
 * and still stand for all of them, by naming the area it covers.
 */
describe('an entry that covers a wider area than the page it links to', () => {
  const renderAdmin = (pathname) => renderOption(pathname, '/admin/members', 'Admin', '/admin');

  it('keeps linking to its own path', () => {
    renderAdmin('/');

    expect(link('Admin')).toHaveAttribute('href', '/admin/members');
  });

  it('is marked on a page of the area that is not the one it links to', () => {
    renderAdmin('/admin/attendance');

    expect(link('Admin')).toHaveAttribute('aria-current', 'page');
    expect(link('Admin')).toHaveClass('option__link--active');
  });

  it('is marked on the page it links to', () => {
    renderAdmin('/admin/members');

    expect(link('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('is marked on the area itself', () => {
    renderAdmin('/admin');

    expect(link('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('is marked on a page deeper than one segment', () => {
    renderAdmin('/admin/members/member-1');

    expect(link('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('is not marked on a route that only shares the prefix of the area', () => {
    renderAdmin('/administracion');

    expect(link('Admin')).not.toHaveAttribute('aria-current');
  });

  it('is not marked outside the area', () => {
    renderAdmin('/account');

    expect(link('Admin')).not.toHaveAttribute('aria-current');
  });

  it('covers only the page it links to when it names no area', () => {
    renderOption('/admin/attendance', '/admin/members', 'Admin');

    expect(link('Admin')).not.toHaveAttribute('aria-current');
  });
});
