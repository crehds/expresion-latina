import { Component } from 'react';
import PropTypes from 'prop-types';
import Swal from 'sweetalert2';
import '../css/register.css';

function handleEnableButtonRegister(enable) {
  const registerButton = document.getElementById('register-change-button');
  if (registerButton) {
    registerButton.disabled = !enable;
  }
}

function handleChecked(event) {
  const { id } = event.target;
  if (id === 'M') {
    const element = document.getElementById('F');
    element.checked = false;
  } else {
    const element = document.getElementById('M');
    element.checked = false;
  }
}

function handleTypeEvent(event, nameToSet) {
  /* eslint-disable-next-line no-param-reassign */
  event.target.type = nameToSet;
}

export default class Register extends Component {
  constructor(props) {
    super(props);
    this.state = {
      arrowDisplay: false,
      partRegister: true,
      user: '',
      login: '',
      nameUser: false,
      password: false,
    };
  }

  handlePartRegister = () => {
    const { partRegister, arrowDisplay } = this.state;
    this.setState({
      partRegister: !partRegister,
      arrowDisplay: !arrowDisplay,
    });
  };

  handleCheckFieldsInput = (event) => {
    event.preventDefault();
    const form = new FormData(document.getElementById('form-prueba'));
    const data = { ...form };
    const allInputsWithContent = Object.values(data).every((e) => e);
    if (allInputsWithContent) {
      this.handleData(data);
    } else {
      Swal.fire({
        icon: 'warning',
        text: 'Faltan llenar campos',
      });
    }
  };

  handleData = (data) => {
    const { partRegister, user, login } = this.state;
    const { showDataForm } = this.props;
    if (partRegister) {
      this.setState({ user: { ...data } });
      this.handlePartRegister();
    } else {
      this.setState({ login: { ...data } });
      setTimeout(() => showDataForm(user, login));
    }
  };

  handleOnInput = async (event) => {
    const namelogin = event.target.value;
    const element = document.getElementById(event.target.id);

    const result = await fetch(`/login/getLogin/${namelogin}`, {
      method: 'GET',
    }).then((response) => response.json());

    if (!result.data) {
      if (element.classList.contains('namefalse')) {
        element.classList.remove('namefalse');
      }
      element.classList.add('nametrue');

      this.setState({ nameUser: true });
    } else {
      if (element.classList.contains('nametrue')) {
        element.classList.remove('nametrue');
      }
      element.classList.add('namefalse');
      this.setState({ nameUser: false });
    }
  };

  handleConfirmPassword = (event) => {
    const password = document.getElementById('password');
    const repassword = event.target;
    if (password.value === repassword.value) {
      if (password.classList.contains('namefalse')) {
        password.classList.remove('namefalse');
        repassword.classList.remove('namefalse');
      }
      password.classList.add('nametrue');
      repassword.classList.add('nametrue');
      this.setState({ password: true });
    } else {
      if (password.classList.contains('nametrue')) {
        password.classList.remove('nametrue');
        repassword.classList.remove('nametrue');
      }
      password.classList.add('namefalse');
      repassword.classList.add('namefalse');
      this.setState({ password: false });
    }
  };

  render() {
    const {
      arrowDisplay, partRegister, password, nameUser,
    } = this.state;
    const { handleStateLogin } = this.props;
    return (
      <form
        id="form-prueba"
        action=""
        className="register-form"
        onSubmit={this.handleCheckFieldsInput}
      >
        <div className="title-form__container">
          <h3>Regístrate</h3>
          {arrowDisplay && (
            <i
              id="arrow-form-register"
              className="icon-arrow-left2 form-register"
              onClick={this.handlePartRegister}
              onKeyDown={this.handlePartRegister}
              role="button"
              tabIndex={0}
              aria-label="icon-arrow"
            />
          )}
        </div>

        {partRegister === true ? (
          <>
            <input key="1" type="text" name="name" placeholder="Nombres" />
            <input
              key="2"
              type="text"
              name="lastname"
              placeholder="Apellidos"
            />
            <input key="3" type="email" name="email" placeholder="Correo" />
            <div className="register-container__auxiliar">
              <input
                className="register-container__auxiliar-date"
                key="4"
                type="text"
                onBlur={(event) => handleTypeEvent(event, 'text')}
                onFocus={(event) => handleTypeEvent(event, 'date')}
                name="edad"
                placeholder="Fecha de Nacimiento"
              />

              <div className="register-container__auxiliar-checkbox">
                <label htmlFor="M">
                  <input
                    type="checkbox"
                    id="M"
                    name="genero"
                    value="M"
                    onClick={handleChecked}
                    defaultChecked
                  />
                  <p htmlFor="M">M</p>

                </label>
              </div>
              <div className="register-container__auxiliar-checkbox">
                <label htmlFor="F">
                  <input
                    type="checkbox"
                    id="F"
                    name="genero"
                    value="F"
                    onClick={handleChecked}
                  />
                  <p>F</p>
                </label>
              </div>
            </div>

            <input key="5" type="tel" name="telefono" placeholder="Teléfono" />
          </>
        ) : (
          <>
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
          </>
        )}

        <div className="form-register-buttons">
          {partRegister === true ? (
            <button
              key="register-1"
              type="button"
              id="register-change-button-1"
              className="form-button"
              onClick={this.handleCheckFieldsInput}
            >
              Siguiente Paso
            </button>
          ) : (
            <button
              key="register-2"
              id="register-change-button"
              className="form-button"
              type="submit"
              disabled
            >
              Registrarme
            </button>
          )}
          {password && nameUser === true
            ? handleEnableButtonRegister(true)
            : handleEnableButtonRegister(false)}
          <button
            id="Session"
            className="form-button"
            onClick={handleStateLogin}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }
}

Register.propTypes = {
  showDataForm: PropTypes.func.isRequired,
  handleStateLogin: PropTypes.func.isRequired,
};
