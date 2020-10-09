import React, { Component } from "react";
import "../css/register.css";

export default class Register extends Component {
  state = {
    arrowDisplay: false,
    partRegister: true,
    user: "",
    login: "",
  };

  handlePartRegister = (event) => {
    return this.setState({
      partRegister: !this.state.partRegister,
      arrowDisplay: !this.state.arrowDisplay,
    });
  };

  getKeysAndValues = (form) => {
    let keys = [];
    let values = [];
    for (let key of form.keys()) {
      keys.push(key);
    }
    for (let value of form.values()) {
      values.push(value);
    }
    const user = Object.assign(...keys.map((k, i) => ({ [k]: values[i] })));
    return user;
  };

  handleData = (event) => {
    console.log('formaluario de registro');
    const form = new FormData(document.getElementById("form-prueba"));
    const data = Object.assign({}, this.getKeysAndValues(form));
    console.log(data);
    if (this.state.partRegister) {
      this.setState({ user: {...data} });
      this.handlePartRegister();
    } else {
      event.preventDefault();
      this.setState({ login: {...data} });
      setTimeout(() => this.props.showDataForm(this.state.user, this.state.login))
    }
  };

  render() {
    return (
      <form
        id="form-prueba"
        action=""
        className="register-form"
        onSubmit={this.handleData}
      >
        <div className="title-form__container">
          <h3>Regístrate</h3>
          {this.state.arrowDisplay && (
            <i
              id="arrow-form-register"
              className="icon-arrow-left2 form-register"
              onClick={this.handlePartRegister}
            ></i>
          )}
        </div>

        {this.state.partRegister === true ? (
          <React.Fragment>
            <input key="1" type="text" name="name" placeholder="Nombres" />
            <input
              key="2"
              type="text"
              name="lastname"
              placeholder="Apellidos"
            />
            <input key="3" type="email" name="email" placeholder="Correo" />
            <input key="4" type="text" name="edad" placeholder="Edad" />
            <input key="5" type="tel" name="telefono" placeholder="Teléfono" />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <input
              key="6"
              type="text"
              name="usuario"
              placeholder="Nombre de usuario"
            />
            <input
              key="7"
              type="password"
              name="password"
              placeholder="Contraseña"
            />
            <input
              key="8"
              type="password"
              name="re-password"
              placeholder="Re-Contraseña"
            />
          </React.Fragment>
        )}

        {/* <input type="password" name="Contraseña" placeholder="Contraseña" /> */}
        <div className="form-register-buttons">
          {this.state.partRegister === true ? (
            <button
              key="1"
              type="button"
              id="register-change-button"
              className="form-button"
              onClick={this.handleData}
            >
              Siguiente Paso
            </button>
          ) : (
            <button
              key="register-2"
              id="register-change-button"
              className="form-button"
            >
              Registrarme
            </button>
          )}

          <button id="Session" className="form-button" onClick={this.props.handleStateLogin}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }
}
