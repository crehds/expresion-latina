import { Component } from 'react';

import { Hamburger, Options } from './components';

import './css/menu.css';

// Below this the links do not fit on one line, so they move into a drawer.
const WIDE_SCREEN = '(min-width: 1024px)';

/**
 * The navigation, in the only two shapes it needs.
 *
 * On a desktop the links sit in the bar; there is room, and hiding six links
 * behind a button costs a click for nothing. On a tablet or a phone they move
 * into a drawer and the hamburger appears.
 *
 * Whether the drawer is open is state here rather than a class toggled onto
 * the DOM by hand: the old version reached for document.querySelector from an
 * event handler, so React had no idea the menu was open and any re-render
 * silently reverted it.
 */
class Menu extends Component {
  constructor(props) {
    super(props);

    this.mediaQuery = window.matchMedia(WIDE_SCREEN);

    this.state = {
      // Read before the first paint so the right shape renders straight away.
      isWide: this.mediaQuery.matches,
      isOpen: false,
    };
  }

  componentDidMount() {
    this.mediaQuery.addEventListener('change', this.handleViewportChange);
  }

  componentWillUnmount() {
    this.mediaQuery.removeEventListener('change', this.handleViewportChange);
  }

  // Growing the window past the breakpoint closes the drawer, otherwise it
  // would stay open behind the inline links that just replaced it.
  handleViewportChange = (event) => this.setState({ isWide: event.matches, isOpen: false });

  handleToggle = () => this.setState((state) => ({ isOpen: !state.isOpen }));

  handleNavigate = () => this.setState({ isOpen: false });

  render() {
    const { isWide, isOpen } = this.state;

    if (isWide) {
      return (
        <nav className="menu menu--inline" aria-label="Principal">
          <Options onNavigate={this.handleNavigate} />
        </nav>
      );
    }

    return (
      <>
        <Hamburger isOpen={isOpen} onToggle={this.handleToggle} />
        <nav
          id="main-menu"
          className={`menu menu--drawer${isOpen ? ' menu--is-open' : ''}`}
          aria-label="Principal"
          // Closed, the drawer is off-screen but still in the document, so it
          // would otherwise stay in the tab order and be read aloud.
          aria-hidden={!isOpen}
          inert={!isOpen ? '' : undefined}
        >
          <Options onNavigate={this.handleNavigate} />
        </nav>
      </>
    );
  }
}

export default Menu;
