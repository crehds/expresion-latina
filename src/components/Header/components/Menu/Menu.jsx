import { PureComponent } from 'react';
import './css/menu.css';

import { Hamburger, Options } from './components';

class Menu extends PureComponent {
  handleIsMenuActive = () => {
    const hamburger = document.getElementById('hamburger');
    const hamburgerClass = hamburger.classList;
    const menuClass = document.getElementById('menu').classList;

    // TODO: Optimized
    if (hamburgerClass.contains('is-active')) {
      hamburgerClass.remove('is-active');
      menuClass.remove('is-active');
      hamburger.style.animationName = 'none';
      document.removeEventListener('click', this.removeListener);
    } else {
      hamburgerClass.add('is-active');
      hamburger.style.animationName = 'gradientefect';
      menuClass.add('is-active');
      document.addEventListener('click', this.removeListener);
    }
  };

  removeListener = (event) => {
    const template = document.getElementById('menu').contains(event.target);
    if (!template) {
      this.handleIsMenuActive();
    }
  };

  render() {
    return (
      <div id="menu" className="menu">
        <Hamburger handleIsMenuActive={this.handleIsMenuActive} />
        <Options />
      </div>
    );
  }
}

export default Menu;
