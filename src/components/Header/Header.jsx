import { Logo, Menu } from './components';

import './css/header.css';

function Header() {
  return (
    <header className="header">
      <Logo />
      <Menu />
    </header>
  );
}

export default Header;
