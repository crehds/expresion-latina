import React, { Component } from 'react'
import '../css/configlogin.css'

export default class ConfigLogin extends Component {

  getInputstag = () => {
    const inputs = [...document.querySelectorAll("input[type=text]")]
    for(let i of inputs) {
      i.disabled = !i.disabled;
    }
  }

  render() {
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button onClick={this.getInputstag}>Editar</button>
        <button onClick={this.props.func}>Guardar</button>
        <button onClick={this.props.unLogged}>Salir</button>
      </div>
    )
  }
}
