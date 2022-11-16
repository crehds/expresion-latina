import React, { Component } from 'react';
import Mapa from './components/Mapa';
import Online from './components/Online';

import './css/contacto.css';
export default class Contact extends Component {
  state = {
    content: 'mapa'
  };

  componentWillUnmount() {
    this.props.handleLoading();
  }

  showContact = (contact) => {
    switch (contact) {
      case 'mapa':
        return <Mapa />;
      case 'online':
        return <Online />;
      default:
        break;
    }
  };

  setContent = (event) => {
    let id = event.target.id;
    this.setState({
      content: id
    });
  };
  render() {
    return (
      <div className='contacto'>
        <h3 id='mapa' className='pestaña' onClick={this.setContent}>
          Mapa
        </h3>
        <h3 id='online' className='pestaña' onClick={this.setContent}>
          Online
        </h3>
        {this.showContact(this.state.content)}
      </div>
    );
  }
}
