import { Link } from 'react-router-dom';

import { Logo, Menu } from './components';

import './css/header.css';

/**
 * The bar across the top: the academy on the left, the way around the site on
 * the right.
 *
 * The logo used to float in the middle of an otherwise empty band at a size
 * that read as an afterthought. It anchors the left edge now and links home,
 * which is what a visitor expects of it.
 */
function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link className="header__home" to="/" aria-label="Expresión Latina, inicio">
          <Logo />
        </Link>
        <Menu />
      </div>
    </header>
  );
}

export default Header;
