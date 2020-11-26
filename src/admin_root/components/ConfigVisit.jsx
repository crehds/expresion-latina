import React, { Component } from "react";
import AdminContainer from "./AdminContainer";
import ConfigLogin from "./ConfigLogin";
import IconConfig from "./IconConfig";

//Temporal
//Se espera que a futuro la lógica cambie y se diferencia del config de Estudiante
export default class ConfigVisit extends Component {
  handleConfigToShow = (mainContent) => {
    switch (mainContent) {
      case "Login":
        return (
          <AdminContainer>
            <IconConfig handleDisplayConfig={this.props.handleDisplayConfig} />
            {this.props.display && (
              <ConfigLogin
                func={this.props.func}
                unLogged={this.props.unLogged}
              />
            )}
          </AdminContainer>
        );

      default:
        return <div></div>;
    }
  };

  render() {
    return this.handleConfigToShow(this.props.mainContent);
  }
}
