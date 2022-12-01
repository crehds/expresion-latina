import './css/menu.css';

import { Hamburger, Options } from './components';

function handleMenu(event) {
  const hamburger = event.target;
  const hamburgerStyles = hamburger.classList;
  const menuStyles = document.querySelector('.menu').classList;

  hamburgerStyles.toggle('hamburger--is-active');
  menuStyles.toggle('menu--is-active');
}

function Menu() {
  return (
    <div className="menu">
      <Hamburger handleMenu={handleMenu} />
      <Options />
    </div>
  );
}

export default Menu;
