import React, { Component } from 'react';
import '../css/modalAdmin.css';

import ConfigStudent from './ConfigStudent';
import ConfigAdmin from './ConfigAdmin';
import ConfigVisit from './ConfigVisit';

export default class ModalAdmin extends Component {
  state = {
    display: false
  };

  handleDisplayConfig = () => this.setState({ display: !this.state.display });

  handleConfigToShow = (typeOfUser) => {
    switch (typeOfUser) {
      case 'Administrador':
        return (
          <ConfigAdmin
            globalProps={this.props.globalProps}
            func={this.props.func}
            handleDisplayConfig={this.handleDisplayConfig}
            display={this.state.display}
            mainContent={this.props.mainContent}
            unLogged={this.props.unLogged}
          />
        );
      case 'Estudiante':
        return (
          <ConfigStudent
            handleDisplayConfig={this.handleDisplayConfig}
            func={this.props.func}
            display={this.state.display}
            mainContent={this.props.mainContent}
            unLogged={this.props.unLogged}
          />
        );
      case 'Visitante':
        return (
          <ConfigVisit
            handleDisplayConfig={this.handleDisplayConfig}
            func={this.props.func}
            display={this.state.display}
            mainContent={this.props.mainContent}
            unLogged={this.props.unLogged}
          />
        );
      default:
        break;
    }
  };

  render() {
    return (
      <div className='modal-admin'>
        {this.handleConfigToShow(this.props.typeOfUser)}
      </div>
    );
  }
}
