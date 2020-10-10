import React, { Component } from 'react'
import '../css/configlogin.css'

export default class ConfigLogin extends Component {

  getInputstag = () => {
    const inputs = [...document.querySelectorAll("input[type=text]")]
    console.log(inputs);
    for(let i of inputs) {
      i.disabled = !i.disabled;
    }
  }

  render() {
    console.log(this.props.func);
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button onClick={this.getInputstag}>Editar</button>
        <button onClick={this.props.func}>Guardar</button>
        <button >Salir</button>
      </div>
    )
  }
}
