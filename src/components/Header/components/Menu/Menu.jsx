import './css/menu.css';

import { Hamburger, Options } from './components';

function handleMenu(event) {
  const hamburger = event.target;
  const hamburgerStyles = hamburger.classList;
  const menuStyles = document.querySelector('.menu').classList;

  hamburgerStyles.toggle('is-active');
  menuStyles.toggle('is-active');
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
