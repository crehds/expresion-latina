import React, { Component } from 'react';
import '../css/menu.css';
import HamburguerMenu from './HamburguerMenu';
import Options from './Options';
import UserImage from './UserImage';

class Menu extends Component {
  sendContent = (event) => {
    return this.props.handleContent(event.target.id);
  };

  handleIsMenuActive = () => {
    let hamburguer = document.getElementById('hamburguer');
    let hamburguerClass = hamburguer.classList;
    let menuClass = document.getElementById('menu').classList;

    // TODO: Optimized
    if (hamburguerClass.contains('is-active')) {
      hamburguerClass.remove('is-active');
      menuClass.remove('is-active');
      hamburguer.style.animationName = 'none';
      document.removeEventListener('click', this.removeListener);
    } else {
      hamburguerClass.add('is-active');
      hamburguer.style.animationName = 'gradientefect';
      menuClass.add('is-active');
      document.addEventListener('click', this.removeListener);
    }
  };

  removeListener = (event) => {
    let template = document.getElementById('menu').contains(event.target);
    if (!template) {
      this.handleIsMenuActive();
    }
  };

  render() {
    return (
      <div id='menu' className='menu'>
        <HamburguerMenu handleIsMenuActive={this.handleIsMenuActive} />
        {this.props.profile && <UserImage />}
        <Options sendContent={this.sendContent} profile={this.props.profile} />
      </div>
    );
  }
}

export default Menu;
