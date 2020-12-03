import React, { Component } from "react";
import "./css/login.css";
import Register from "./components/Register";
import Session from "./components/Session";
import Profile from "./components/profile_root/Profile";
import Swal from "sweetalert2";
import admin from "../../../api/admin.json";
export default class Login extends Component {
  // state = {
  // };

  showMessageDev = (event) => {
    event.preventDefault();
    const admin = this.handlerLoginAdmin();
    if (admin) {
      this.setState({ contentLogin: "Profile" });
      this.props.handleIsAdmin();
      Swal.fire({
        icon: "success",
        text: "Bienvenida Doña Fernández",
      });
      this.props.headerFunc(true);
    } else {
      Swal.fire({
        icon: "info",
        text: "En desarrollo",
      });
    }
    // Swal.fire({
    //   icon: "info",
    //   text: "En desarrollo",
    // });
  };

  findUser = async (event) => {
    event.preventDefault();
    const name = document.getElementById("session-usuario").value;
    const password = document.getElementById("session-password").value;
    const { data } = await fetch("/login/findUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: {
          name,
          password,
        },
      }),
    }).then((result) => result.json());
    console.log(data);

    if (data) {
      this.props.headerFunc(true);
      this.props.handleTypeOfUser(data.user[0].Tipo_usuario);
      data.user[0].fechaNacimiento = this.convertToDate({ ...data.user[0] });
      this.props.handleInfoLogin("Profile", data.user[0], data.login[0]);
    } else {
      Swal.fire({
        icon: "error",
        text: "Datos erróneos",
      });
    }
  };

  gettingAgeUser = (user) => {
    // console.log(user);
    let edad = user.fechaNacimiento || user.edad;
    let temp = new Date(Date.now() - new Date(edad).getTime());

    return Math.abs(temp.getUTCFullYear() - 1970);
  };

  convertToDate = (user) => {
    let edad = user.fechaNacimiento || user.edad;
    console.log();
    let date = new Date(edad);
    let yyyy = date.getFullYear();
    let mm = (date.getMonth() + 1).toString();
    let dd = date.getDate().toString();

    return `${yyyy}-${mm.length === 1 ? `0${mm}` : mm}-${
      dd.length === 1 ? `0${dd}` : dd
    }`;
  };
  showDataForm = async (user, login) => {
    const result = await fetch("/login/createUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user, login }),
    }).then((result) => result.json());
    console.log(result);
    this.props.headerFunc(true);
    user.edad = this.convertToDate({ ...user });
    this.props.handleInfoLogin("Profile", user, login);
  };

  handlerLoginAdmin = () => {
    const usuario = document.getElementById("session-usuario").value;
    const password = document.getElementById("session-password").value;
    if (admin.username === usuario && admin.password === password) {
      return true;
    }
    return false;
  };

  showMessageRegister = () => {
    Swal.fire({
      icon: "info",
      text:
        "Luego de registrarte con datos básicos podrás añadir mas información a tu perfil",
    });
  };

  handleStateLogin = (event) => {
    return this.setState({ contentLogin: event.target.id });
  };

  handleContentLogin = (content) => {
    switch (content) {
      case "Session":
        return (
          <Session
            handleStateLogin={this.props.handleContentLogin}
            showMessageDev={this.showMessageDev}
            findUser={this.findUser}
          />
        );
      case "Register":
        this.showMessageRegister();
        return (
          <Register
            handleStateLogin={this.props.handleContentLogin}
            showMessageDev={this.showMessageDev}
            showDataForm={this.showDataForm}
          />
        );
      case "Profile":
        return (
          <Profile
            userRegistered={this.props.Login}
            getFunction={this.props.getFunction}
          />
        );
      default:
        break;
    }
  };

  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    return (
      <div className="login">
        {this.handleContentLogin(this.props.Login.content)}
      </div>
    );
  }
}
