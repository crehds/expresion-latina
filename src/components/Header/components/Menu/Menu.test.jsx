import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Menu from './Menu';

const realMatchMedia = window.matchMedia;

/*
 * The stub in setupTests answers one fixed value and ignores its listeners,
 * which is enough for a suite that only needs the narrow layout to render. This
 * one is controllable: Menu subscribes on mount and unsubscribes on unmount, so
 * the listener set is what proves the subscription was actually torn down.
 */
function mockViewport(isWide) {
  const listeners = new Set();
  const query = {
    matches: isWide,
    media: '(min-width: 1024px)',
    addEventListener: (_event, fn) => listeners.add(fn),
    removeEventListener: (_event, fn) => listeners.delete(fn),
  };

  window.matchMedia = () => query;

  return {
    listeners,
    // Crossing the breakpoint the way the browser reports it: the flag flips,
    // then every subscriber hears about it.
    cross(next) {
      query.matches = next;
      act(() => listeners.forEach((fn) => fn({ matches: next })));
    },
  };
}

const renderMenu = () => render(<Menu />, { wrapper: MemoryRouter });

const hamburger = () => screen.getByRole('button', { name: /men[úu]/i });
const drawer = () => screen.getByLabelText('Principal');

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

/*
 * Below 1024px the drawer is the only navigation on the site, so a toggle that
 * silently stops working leaves a phone visitor with no way off the page they
 * are on. None of this was covered.
 */
describe('the drawer on a phone', () => {
  beforeEach(() => {
    mockViewport(false);
    renderMenu();
  });

  it('offers the hamburger', () => {
    expect(hamburger()).toBeInTheDocument();
  });

  it('starts closed, and says so', () => {
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(drawer()).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens when the hamburger is pressed', () => {
    fireEvent.click(hamburger());

    expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
    expect(drawer()).toHaveAttribute('aria-hidden', 'false');
  });

  it('closes again on a second press', () => {
    fireEvent.click(hamburger());
    fireEvent.click(hamburger());

    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(drawer()).toHaveAttribute('aria-hidden', 'true');
  });

  // Otherwise the drawer stays over the page the visitor just asked for.
  it('closes when a link is followed', () => {
    fireEvent.click(hamburger());
    fireEvent.click(screen.getByRole('link', { name: 'Horario' }));

    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('renames the control for what it will do next', () => {
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();

    fireEvent.click(hamburger());

    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toBeInTheDocument();
  });
});

describe('the bar on a desktop', () => {
  beforeEach(() => {
    mockViewport(true);
    renderMenu();
  });

  it('shows the links without a button in front of them', () => {
    expect(screen.getByRole('link', { name: 'Horario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /men[úu]/i })).not.toBeInTheDocument();
  });

  // Nothing is hidden on a desktop, so nothing should claim to be.
  it('does not hide the navigation from assistive technology', () => {
    expect(drawer()).not.toHaveAttribute('aria-hidden');
  });
});

describe('crossing the breakpoint', () => {
  it('replaces the drawer with the inline bar on the way up', () => {
    const viewport = mockViewport(false);
    renderMenu();

    fireEvent.click(hamburger());
    expect(hamburger()).toHaveAttribute('aria-expanded', 'true');

    viewport.cross(true);

    expect(screen.queryByRole('button', { name: /men[úu]/i })).not.toBeInTheDocument();
    expect(drawer()).not.toHaveAttribute('aria-hidden');
  });

  /*
   * The round trip, and the only way to see this at all: growing past the
   * breakpoint swaps the drawer for the inline links, so an isOpen left set is
   * invisible there — the wide bar renders identically either way. It shows up
   * when the window narrows again and the drawer is suddenly open on its own,
   * over a page nobody asked to leave.
   */
  it('does not reopen itself when the window narrows again', () => {
    const viewport = mockViewport(false);
    renderMenu();

    fireEvent.click(hamburger());
    viewport.cross(true);
    viewport.cross(false);

    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(drawer()).toHaveAttribute('aria-hidden', 'true');
  });

  it('brings the hamburger back on the way down', () => {
    const viewport = mockViewport(true);
    renderMenu();

    viewport.cross(false);

    expect(hamburger()).toBeInTheDocument();
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
  });
});

/*
 * A listener left behind calls setState on an unmounted component, which React
 * reports as a warning rather than a failure — so nothing catches it unless the
 * teardown itself is asserted.
 */
describe('the media query subscription', () => {
  it('is taken out while the menu is mounted', () => {
    const viewport = mockViewport(false);
    const { unmount } = renderMenu();

    expect(viewport.listeners.size).toBe(1);

    unmount();
  });

  it('is removed again on unmount', () => {
    const viewport = mockViewport(false);
    const { unmount } = renderMenu();

    unmount();

    expect(viewport.listeners.size).toBe(0);
  });
});
