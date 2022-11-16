import React, { Component } from 'react';
import '../css/hamburguerMenu.css';

export default class Hamburguer extends Component {
  componentDidMount() {
    let i = document.getElementById('hamburguer');
    i.addEventListener('animationend', this.removeAnimation);
  }

  removeAnimation(event) {
    let i = document.getElementById('hamburguer');
    i.style.animationName = 'none';
  }

  render() {
    return (
      <i
        id='hamburguer'
        className='icon-menu hamburguer-menu'
        onClick={this.props.handleIsMenuActive}
      ></i>
    );
  }
}
