import { PureComponent } from 'react';
import { Logo, Menu } from './components';

import './css/header.css';

export default class Header extends PureComponent {
  render() {
    return (
      <header className="header">
        <Logo />
        <Menu />
      </header>
    );
  }
}
