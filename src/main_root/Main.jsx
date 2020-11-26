import React, { Component } from "react";
import "./css/mainContainer.css";
import Inicio from "./components/inicio_root/Inicio";
import Profesores from "./components/profesores_root/Profesores";
import Clases from "./components/clases_root/Clases";
import Contacto from "./components/contacto_root/Contacto";
import MainContainer from "./container/MainContainer";
import Horario from "./components/horario_root/Horario";
import PageLoading from "../loading_root/PageLoading";
import Reseñas from "./components/reseñas_root/Reseñas";
import Login from "./components/login_root/Login";
import Admin from "../admin_root/Admin";

export default class Main extends Component {
  state = {
    isLoading: false,
    displayConfig: false,
    typeOfUser: undefined,
    globalProps: undefined,
    func: undefined,
    Login: {
      content: "Session",
      user: "",
      login: "",
    },
  };

  componentDidMount() {
    setTimeout(() => this.setState({ isLoading: true }), 1000);
  }

  setGlobalProps = (globalProps) => {
    return this.setState({ globalProps });
  };
  handleLoading = () => {
    this.setState({ isLoading: false });
    if (this.state.displayConfig) {
      setTimeout(() => this.setState({ isLoading: true }), 1000);
    }
  };

  getFunction = (func) => {
    return this.setState({ func });
  };

  handleDisplayConfig = () => {
    this.setState({ displayConfig: !this.state.displayConfig });
  };

  unLogged = () => {
    this.handleDisplayConfig();
    this.setState({
      Login: {
        content: "Session",
        user: "",
        login: "",
      },
    });
    this.props.headerFunc(false);
  };

  handleTypeOfUser = async (idtypeOfUser) => {
    const typeOfUser = await fetch(`/login/TypeOfUser/${idtypeOfUser}`, {
      method: "GET",
    }).then((result) => result.json());
    console.log(typeOfUser);
    this.setState({ typeOfUser: typeOfUser.data[0].tipo_usuario });
    this.handleDisplayConfig();
  };
  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      setTimeout(() => this.setState({ isLoading: true }), 1000);
    }
  }

  handleContentLogin = (event) => {
    return this.setState({
      Login: {
        content: event.target.id,
      },
    });
  };

  handleInfoLogin = (content, user, login) => {
    return this.setState({
      Login: {
        content,
        user,
        login,
      },
    });
  };

  showContent = (content) => {
    switch (content) {
      case "Inicio":
        return (
          <Inicio
            setGlobalProps={this.setGlobalProps}
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
          />
        );
      case "Profesores":
        return (
          <Profesores
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
          />
        );
      case "Clases":
        return <Clases handleLoading={this.handleLoading} />;
      case "Horario":
        return <Horario handleLoading={this.handleLoading} />;
      case "Reseñas":
        return <Reseñas handleLoading={this.handleLoading} />;
      case "Contacto":
        return <Contacto handleLoading={this.handleLoading} />;
      case "Login":
        return (
          <Login
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
            headerFunc={this.props.headerFunc}
            Login={this.state.Login}
            handleContentLogin={this.handleContentLogin}
            handleInfoLogin={this.handleInfoLogin}
            handleTypeOfUser={this.handleTypeOfUser}
          />
        );

      default:
        break;
    }
  };

  render() {
    if (this.state.isLoading === false) {
      return <PageLoading />;
    }
    return (
      <MainContainer>
        {this.showContent(this.props.content)}
        {this.state.displayConfig && (
          <Admin
            maincontent={this.props.content}
            typeOfUser={this.state.typeOfUser}
            globalProps={this.state.globalProps}
            func={this.state.func}
            unLogged={this.unLogged}
          />
        )}
      </MainContainer>
    );
  }
}
