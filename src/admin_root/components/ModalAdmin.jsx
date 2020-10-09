import React, { Component } from "react";
import "../css/modalAdmin.css";


import ConfigStudent from "./ConfigStudent";
import ConfigAdmin from "./ConfigAdmin";

export default class ModalAdmin extends Component {
  state = {
    display: false,
  };

  handleDisplayConfig = () => this.setState({ display: !this.state.display });

  handleConfigToShow = (typeOfUser) => {
    switch(typeOfUser) {
      case "Administrador":
        return (
          <ConfigAdmin globalProps={this.props.globalProps} func={this.props.func} handleDisplayConfig={this.handleDisplayConfig}
          display={this.state.display}
          mainContent={this.props.mainContent}
          />
        );
      case "Estudiante":
        return (<ConfigStudent/>)
      default:
        break;
    }
  }

  render() {
    return (
      <div className="modal-admin">
        {
          this.handleConfigToShow(this.props.typeOfUser)
        }
      </div>
    );
  }
}
