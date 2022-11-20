import { PureComponent } from 'react';
import PropTypes from 'prop-types';

import Swal from 'sweetalert2';

import Register from './components/Register';
import Session from './components/Session';
import Profile from './components/profile_root/Profile';
import ADMIN from '../../../api/admin.json';
import './css/login.css';

// function gettingAgeUser(user) {
//   const edad = user.fechaNacimiento || user.edad;
//   const temp = new Date(Date.now() - new Date(edad).getTime());

//   return Math.abs(temp.getUTCFullYear() - 1970);
// }

function handlerLoginAdmin() {
  const usuario = document.getElementById('session-usuario').value;
  const password = document.getElementById('session-password').value;
  if (ADMIN.username === usuario && ADMIN.password === password) {
    return true;
  }
  return false;
}

function showMessageRegister() {
  Swal.fire({
    icon: 'info',
    text: 'Luego de registrarte con datos básicos podrás añadir mas información a tu perfil',
  });
}

function convertToDate(user) {
  const edad = user.fechaNacimiento || user.edad;
  const date = new Date(edad);
  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString();
  const dd = date.getDate().toString();

  return `${yyyy}-${mm.length === 1 ? `0${mm}` : mm}-${
    dd.length === 1 ? `0${dd}` : dd
  }`;
}

export default class Login extends PureComponent {
  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  showMessageDev = (event) => {
    const { headerFunc } = this.props;
    event.preventDefault();
    const admin = handlerLoginAdmin();
    if (admin) {
      Swal.fire({
        icon: 'success',
        text: 'Bienvenida Doña Fernández',
      });
      headerFunc(true);
    } else {
      Swal.fire({
        icon: 'info',
        text: 'En desarrollo',
      });
    }
  };

  findUser = async (event) => {
    const { headerFunc, handleTypeOfUser, handleInfoLogin } = this.props;
    event.preventDefault();
    const name = document.getElementById('session-usuario').value;
    const password = document.getElementById('session-password').value;
    const { data } = await fetch('/login/findUser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: {
          name,
          password,
        },
      }),
    }).then((result) => result.json());

    if (data) {
      headerFunc(true);
      handleTypeOfUser(data.user[0].Tipo_usuario);
      data.user[0].fechaNacimiento = convertToDate({ ...data.user[0] });
      handleInfoLogin('Profile', data.user[0], data.login[0]);
    } else {
      Swal.fire({
        icon: 'error',
        text: 'Datos erróneos',
      });
    }
  };

  showDataForm = async (user, login) => {
    const { headerFunc } = this.props;
    const newUser = await fetch('/login/createUser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user, login }),
    }).then((response) => response.json());
    headerFunc(true);
    newUser.edad = this.convertToDate({ ...newUser });
  };

  handleContentLogin = (content) => {
    const { handleContentLogin, login, getFunction } = this.props;
    switch (content) {
      case 'Register':
        showMessageRegister();
        return (
          <Register
            handleStateLogin={handleContentLogin}
            showMessageDev={this.showMessageDev}
            showDataForm={this.showDataForm}
          />
        );
      case 'Profile':
        return (
          <Profile
            toggleContent={this.toggleContent}
            userRegistered={login}
            updateProfile={this.updateProfile}
            getFunction={getFunction}
          />
        );
      default:
        return (
          <Session
            handleStateLogin={handleContentLogin}
            showMessageDev={this.showMessageDev}
            findUser={this.findUser}
          />
        );
    }
  };

  render() {
    const { login } = this.props;
    return (
      <div className="login">
        {this.handleContentLogin(login.content)}
      </div>
    );
  }
}

Login.propTypes = {
  login: PropTypes.instanceOf(Object).isRequired,
  handleContentLogin: PropTypes.func.isRequired,
  handleLoading: PropTypes.func.isRequired,
  getFunction: PropTypes.func.isRequired,
  headerFunc: PropTypes.func.isRequired,
  handleInfoLogin: PropTypes.func.isRequired,
  handleTypeOfUser: PropTypes.func.isRequired,
};
