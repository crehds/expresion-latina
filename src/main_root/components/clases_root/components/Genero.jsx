import React, { PureComponent } from 'react';
import '../css/genero.css';

export default class Genero extends PureComponent {
  render() {
    return (
      <div
        id={this.props.content.name}
        ref={this.props.setGeneroRef}
        className='genero'
        onClick={this.props.onclick}
      >
        {this.props.content.name}
      </div>
    );
  }
}
