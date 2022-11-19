import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/mainContainer.css';
import Inicio from './components/inicio_root/Inicio';
import Profesores from './components/profesores_root/Profesores';
import Clases from './components/clases_root/Clases';
import Contacto from './components/contacto_root/Contacto';
import MainContainer from './container/MainContainer';
import Horario from './components/horario_root/Horario';
import PageLoading from '../loading_root/PageLoading';
import Reviews from './components/reviews_root/Reviews';
import Login from './components/login_root/Login';
import Admin from '../admin_root/Admin';

export default class Main extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      displayConfig: false,
      typeOfUser: undefined,
      globalProps: undefined,
      func: undefined,
      login: {
        content: 'Session',
        user: '',
        session: '',
      },
    };
  }

  componentDidMount() {
    setTimeout(() => this.setState({ isLoading: true }), 1000);
  }

  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      setTimeout(() => this.setState({ isLoading: true }), 1000);
    }
  }

  handleDisplayConfig = () => {
    const { displayConfig } = this.state;
    this.setState({ displayConfig: !displayConfig });
  };

  unLogged = () => {
    const { headerFunc } = this.props;
    this.handleDisplayConfig();
    this.setState({
      login: {
        content: 'Session',
        user: '',
        session: '',
      },
    });
    headerFunc(false);
  };

  handleTypeOfUser = async (idtypeOfUser) => {
    const typeOfUser = await fetch(`/login/TypeOfUser/${idtypeOfUser}`, {
      method: 'GET',
    }).then((result) => result.json());

    this.setState({ typeOfUser: typeOfUser.data[0].tipo_usuario });
    this.handleDisplayConfig();
  };

  getFunction = (func) => this.setState({ func });

  handleLoading = () => {
    const { displayConfig } = this.state;
    this.setState({ isLoading: false });
    if (displayConfig) {
      setTimeout(() => this.setState({ isLoading: true }), 1000);
    }
  };

  setGlobalProps = (globalProps) => this.setState({ globalProps });

  handleContentLogin = (event) => this.setState({
    login: {
      content: event.target.id,
    },
  });

  handleInfoLogin = (content, user, session) => this.setState({
    login: {
      content,
      user,
      session,
    },
  });

  showContent = (content) => {
    const { login } = this.state;
    const { headerFunc } = this.props;
    switch (content) {
      case 'Profesores':
        return (
          <Profesores
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
          />
        );
      case 'Clases':
        return <Clases handleLoading={this.handleLoading} />;
      case 'Horario':
        return <Horario handleLoading={this.handleLoading} />;
      case 'Reviews':
        return <Reviews handleLoading={this.handleLoading} />;
      case 'Contacto':
        return <Contacto handleLoading={this.handleLoading} />;
      case 'Login':
        return (
          <Login
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
            headerFunc={headerFunc}
            login={login}
            handleContentLogin={this.handleContentLogin}
            handleInfoLogin={this.handleInfoLogin}
            handleTypeOfUser={this.handleTypeOfUser}
          />
        );
      default:
        return (
          <Inicio
            setGlobalProps={this.setGlobalProps}
            handleLoading={this.handleLoading}
            getFunction={this.getFunction}
          />
        );
    }
  };

  render() {
    const {
      displayConfig, isLoading, typeOfUser, globalProps, func,
    } = this.state;
    const { content } = this.props;
    if (isLoading === false) {
      return <PageLoading />;
    }
    return (
      <MainContainer>
        {this.showContent(content)}
        {displayConfig && (
          <Admin
            maincontent={content}
            typeOfUser={typeOfUser}
            globalProps={globalProps}
            func={func}
            unLogged={this.unLogged}
          />
        )}
      </MainContainer>
    );
  }
}

Main.propTypes = {
  headerFunc: PropTypes.func.isRequired,
  content: PropTypes.string.isRequired,
};
