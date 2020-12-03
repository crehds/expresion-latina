import React, { Component } from "react";
import "../css/configlogin.css";

export default class ConfigLogin extends Component {
  getInputstag = () => {
    const inputs = [...document.querySelectorAll("input[type=text],input[type=date]")];
    const divsIcons = [
      ...document.getElementsByClassName("profile-icon-input__container"),
    ];
    for (let i of inputs) {
      i.disabled = !i.disabled;
    }
    for (let div of divsIcons) {
      div.style.display = div.style.display === "block" ? "none" : "block";
    }
  };

  render() {
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button onClick={this.getInputstag}>Editar</button>
        <button onClick={this.props.func}>Guardar</button>
        <button onClick={this.props.unLogged}>Salir</button>
      </div>
    );
  }
}
