import React, { Component } from "react";
import AdminContainer from "./AdminContainer";
import Config from "./Config";
import ConfigLogin from "./ConfigLogin";
import IconConfig from "./IconConfig";

export default class ConfigAdmin extends Component {
  handleConfigToShow = (mainContent) => {
    switch (mainContent) {
      case "Inicio":
        return (
          <Config globalProps={this.props.globalProps} func={this.props.func} />
        );
      case "Login":
        return (<ConfigLogin func={this.props.func} 
          unLogged={this.props.unLogged}/>)
          
      default:
        break;
    }
  };

  render() {
    return (
      <AdminContainer>
        <IconConfig handleDisplayConfig={this.props.handleDisplayConfig} />
        {this.props.display && this.handleConfigToShow(this.props.mainContent)}
      </AdminContainer>
    );
  }
}
