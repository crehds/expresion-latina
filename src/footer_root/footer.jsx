import React, { Component } from 'react';
import './css/footer.css';

export default class Footer extends Component {
  render() {
    return (
      <footer className='footer-container'>
        <a
          className='icon-facebook-square'
          href='http://www.facebook.com/expresionlatina.peru'
          target='_blank'
          rel='noopener noreferrer'
        ></a>
        <a
          className='icon-instagram'
          href='http://www.instagram.com/expresionlatina.peru/'
          target='_blank'
          rel='noopener noreferrer'
        ></a>
      </footer>
    );
  }
}
