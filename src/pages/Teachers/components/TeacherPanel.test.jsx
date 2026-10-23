import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import TeacherPanel from './TeacherPanel';

/*
 * The panel takes two global side effects on mount: a document-level keydown
 * listener and body.has-panel, which App.css turns into overflow: hidden on
 * the whole document.
 *
 * Only componentWillUnmount undoes them, so a panel that fails to clean up
 * does not break the faculty page — it freezes scrolling on every route, and
 * nothing a visitor does will unfreeze it. That is the failure worth pinning,
 * because it is close to invisible in manual use: you notice it two pages
 * later, on a page that looks fine.
 */
const TEACHER = {
  id: 'mishel',
  name: 'Mishel Fernández',
  initials: 'MF',
  genreIds: [],
  social: {},
  achievements: [],
};

const renderPanel = (onClose = () => {}) => render(
  <TeacherPanel teacher={TEACHER} onClose={onClose} />,
  { wrapper: MemoryRouter },
);

describe('the teacher panel', () => {
  it('locks the page behind it while it is open', () => {
    renderPanel();

    expect(document.body.classList.contains('has-panel')).toBe(true);
  });

  it('gives the page back when it closes', () => {
    const { unmount } = renderPanel();
    unmount();

    expect(document.body.classList.contains('has-panel')).toBe(false);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('stops listening for Escape once it is gone', async () => {
    const onClose = vi.fn();
    const { unmount } = renderPanel(onClose);
    unmount();

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  describe('focus', () => {
    const openers = [];

    afterEach(() => {
      openers.splice(0).forEach((opener) => opener.remove());
    });

    const addOpener = () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      openers.push(opener);
      return opener;
    };

    it('moves to the close button when it opens', () => {
      addOpener();
      renderPanel();

      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    });

    it('goes back to what had it before the panel opened', () => {
      const opener = addOpener();
      const { unmount } = renderPanel();
      unmount();

      expect(opener).toHaveFocus();
    });

    it('lets go quietly when that element has left the document', () => {
      const opener = addOpener();
      const { unmount } = renderPanel();
      opener.remove();

      expect(unmount).not.toThrow();
      expect(opener).not.toHaveFocus();
    });

    it('does not focus the body when nothing had focus', () => {
      const focusBody = vi.spyOn(document.body, 'focus');
      const { unmount } = renderPanel();
      unmount();

      expect(focusBody).not.toHaveBeenCalled();
      focusBody.mockRestore();
    });
  });

  it('closes from its own button', async () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalled();
  });
});
