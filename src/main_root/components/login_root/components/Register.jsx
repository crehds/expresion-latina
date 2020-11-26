import React, { Component } from "react";
import "../css/register.css";

export default class Register extends Component {
  state = {
    arrowDisplay: false,
    partRegister: true,
    user: "",
    login: "",
    nameUser: false,
    password: false,
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
    console.log("formaluario de registro");
    const form = new FormData(document.getElementById("form-prueba"));
    const data = Object.assign({}, this.getKeysAndValues(form));
    console.log(data);
    if (this.state.partRegister) {
      this.setState({ user: { ...data } });
      this.handlePartRegister();
    } else {
      event.preventDefault();
      this.setState({ login: { ...data } });
      setTimeout(() =>
        this.props.showDataForm(this.state.user, this.state.login)
      );
    }
  };

  handleOnInput = async (event) => {
    console.log(event.target);
    const namelogin = event.target.value;
    const element = document.getElementById(event.target.id);

    const result = await fetch(`/login/getLogin/${namelogin}`, {
      method: "GET",
    }).then((result) => result.json());
    console.log(result);
    if (!result.data) {
      console.log("holi");
      if (element.classList.contains("namefalse")) {
        element.classList.remove("namefalse");
      }
      element.classList.add("nametrue");

      this.setState({ nameUser: true });
    } else {
      if (element.classList.contains("nametrue")) {
        element.classList.remove("nametrue");
      }
      element.classList.add("namefalse");
      this.setState({ nameUser: false });
    }
  };

  handleConfirmPassword = (event) => {
    const password = document.getElementById("password");
    const repassword = event.target;
    if (password.value === repassword.value) {
      if (password.classList.contains("namefalse")) {
        password.classList.remove("namefalse");
        repassword.classList.remove("namefalse");
      }
      password.classList.add("nametrue");
      repassword.classList.add("nametrue");
      this.setState({ password: true });
    } else {
      if (password.classList.contains("nametrue")) {
        password.classList.remove("nametrue");
        repassword.classList.remove("nametrue");
      }
      password.classList.add("namefalse");
      repassword.classList.add("namefalse");
      this.setState({ password: false });
    }
  };

  handleEnableButtonRegister = (enable) => {
    const registerButton = document.getElementById("register-change-button");
    if (registerButton) {
      registerButton.disabled = !enable;
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
            <div className="register-container__auxiliar">
              <input className="register-container__auxiliar-date" key="4" type="date" name="edad" />

              <div className="register-container__auxiliar-checkbox">
                <input type="checkbox" id="M" name="genero" value="M" />
                <label htmlFor="M">M</label>
              </div>
              <div className="register-container__auxiliar-checkbox">
                <input type="checkbox" id="F" name="genero" value="F" />
                <label htmlFor="F">F</label>
              </div>
            </div>

            <input key="5" type="tel" name="telefono" placeholder="Teléfono" />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <input
              id="username"
              key="6"
              type="text"
              name="usuario"
              placeholder="Nombre de usuario"
              onInput={this.handleOnInput}
            />
            <input
              id="password"
              key="7"
              type="password"
              name="password"
              placeholder="Contraseña"
              autoComplete="off"
            />
            <input
              id="repassword"
              key="8"
              type="password"
              name="re-password"
              placeholder="Re-Contraseña"
              autoComplete="off"
              onChange={this.handleConfirmPassword}
            />
          </React.Fragment>
        )}

        {/* <input type="password" name="Contraseña" placeholder="Contraseña" /> */}
        <div className="form-register-buttons">
          {this.state.partRegister === true ? (
            <button
              key="register-1"
              type="button"
              id="register-change-button-1"
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
              disabled
            >
              Registrarme
            </button>
          )}
          {this.state.password && this.state.nameUser === true
            ? this.handleEnableButtonRegister(true)
            : this.handleEnableButtonRegister(false)}
          <button
            id="Session"
            className="form-button"
            onClick={this.props.handleStateLogin}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }
}
