import React, { Component } from 'react';
import Genero from './Genero';
import '../css/generos.css';

export default class Generos extends Component {
  render() {
    let { generos, toggleContent, setGeneroRef } = this.props;
    return (
      <div className='generos'>
        {generos.length > 0 &&
          generos.map((e, i) => (
            <Genero
              key={i}
              content={e}
              onclick={toggleContent}
              setGeneroRef={setGeneroRef}
            />
          ))}
      </div>
    );
  }
}
