import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SessionContext from '../../../../../features/accounts/composition/SessionProvider';
import Options from './Options';

const FIVE = ['Inicio', 'Profesores', 'Clases', 'Horario', 'Encuéntranos'];

const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};

// `session` omitted renders with no provider at all, as the app does while the
// backend is off.
function renderOptions({ session = undefined, path = '/' } = {}) {
  const options = <Options onNavigate={vi.fn()} />;
  render(
    <MemoryRouter initialEntries={[path]}>
      {session
        ? <SessionContext.Provider value={session}>{options}</SessionContext.Provider>
        : options}
    </MemoryRouter>,
  );
}

const labels = () => within(screen.getByRole('list'))
  .getAllByRole('link')
  .map((link) => link.textContent);

describe('Options', () => {
  it('lists exactly the five public entries with no session provider', () => {
    renderOptions();

    expect(labels()).toEqual(FIVE);
  });

  it.each(['disabled', 'loading'])('lists exactly the five public entries when the session is %s', (status) => {
    renderOptions({ session: { status, session: null, profile: null } });

    expect(labels()).toEqual(FIVE);
  });

  it.each(['idle', 'signed-out', 'error'])('adds "Ingresar" to /login when the session is %s', (status) => {
    renderOptions({ session: { status, session: null, profile: null } });

    expect(labels()).toEqual([...FIVE, 'Ingresar']);
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login');
  });

  it('adds "Mi cuenta" to /account, and no "Ingresar", for a signed-in member', () => {
    renderOptions({ session: { status: 'signed-in', session: {}, profile: PROFILE } });

    expect(labels()).toEqual([...FIVE, 'Mi cuenta']);
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/account');
  });

  it('adds "Admin" to /admin/members for a signed-in admin', () => {
    renderOptions({
      session: { status: 'signed-in', session: {}, profile: { ...PROFILE, isAdmin: true } },
    });

    expect(labels()).toEqual([...FIVE, 'Mi cuenta', 'Admin']);
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin/members');
  });

  it('marks the entry of the current route as active, the new ones included', () => {
    renderOptions({
      session: { status: 'signed-in', session: {}, profile: PROFILE },
      path: '/account',
    });

    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('lights "Admin" on a page under /admin/members', () => {
    renderOptions({
      session: { status: 'signed-in', session: {}, profile: { ...PROFILE, isAdmin: true } },
      path: '/admin/members/user-1',
    });

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
  });
});
