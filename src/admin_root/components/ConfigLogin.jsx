import React, { Component } from "react";
import "../css/configlogin.css";

export default class ConfigLogin extends Component {
  state = {
    inputsValue: [],
    saveButton: false,
  };

  editInputstag = () => {
    const inputs = [
      ...document.querySelectorAll("input[type=text],input[type=date]"),
    ];
    if (!this.state.saveButton) {
      const inputsValue = inputs.map((input) => input.value);
      this.setState({
        inputsValue,
        saveButton: true,
      });
    } else {
      for (let i = 0; i < inputs.length; i++) {
        inputs[i].value = this.state.inputsValue[i];
      }
      this.setState({
        inputsValue: [],
        saveButton: false,
      });
    }
    this.getInputstag();
  };

  getInputstag = () => {
    const inputs = [
      ...document.querySelectorAll("input[type=text],input[type=date]"),
    ];
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

  handleSaveInputs = (event) => {
    event.preventDefault();
    this.getInputstag();
    this.props.func();
    return this.setState({
      inputsValue: [],
      saveButton: false,
    });
  };

  componentWillUnmount() {
    this.setState({
      inputValues: [],
      saveButton: false,
    });
  }

  render() {
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button onClick={this.editInputstag}>Editar</button>
        <button onClick={this.handleSaveInputs}>Guardar</button>
        <button onClick={this.props.unLogged}>Salir</button>
      </div>
    );
  }
}
