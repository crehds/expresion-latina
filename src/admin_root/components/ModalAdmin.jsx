import { Component } from 'react';
import PropTypes from 'prop-types';
import '../css/modalAdmin.css';

import ConfigStudent from './ConfigStudent';
import ConfigAdmin from './ConfigAdmin';
import ConfigVisit from './ConfigVisit';

export default class ModalAdmin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      display: false,
    };
  }

  handleDisplayConfig = () => {
    const { display } = this.state;
    this.setState({ display: !display });
  };

  handleConfigToShow = (typeOfUser) => {
    const { display } = this.state;
    const {
      func, globalProps, mainContent, unLogged,
    } = this.props;

    switch (typeOfUser) {
      case 'Administrador':
        return (
          <ConfigAdmin
            globalProps={globalProps}
            func={func}
            handleDisplayConfig={this.handleDisplayConfig}
            display={display}
            mainContent={mainContent}
            unLogged={unLogged}
          />
        );
      case 'Estudiante':
        return (
          <ConfigStudent
            handleDisplayConfig={this.handleDisplayConfig}
            func={func}
            display={display}
            mainContent={mainContent}
            unLogged={unLogged}
          />
        );
      case 'Visitante':
        return (
          <ConfigVisit
            handleDisplayConfig={this.handleDisplayConfig}
            func={func}
            display={display}
            mainContent={mainContent}
            unLogged={unLogged}
          />
        );
      default:
        return <div />;
    }
  };

  render() {
    const { typeOfUser } = this.props;
    return (
      <div className="modal-admin">
        {this.handleConfigToShow(typeOfUser)}
      </div>
    );
  }
}

ModalAdmin.propTypes = {
  globalProps: PropTypes.instanceOf(Array).isRequired,
  func: PropTypes.func.isRequired,
  typeOfUser: PropTypes.string.isRequired,
  unLogged: PropTypes.func.isRequired,
  mainContent: PropTypes.string.isRequired,
};
