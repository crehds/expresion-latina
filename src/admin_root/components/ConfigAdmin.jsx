import React, { Component } from "react";
import AdminContainer from "./AdminContainer";
import Config from "./Config";
import IconConfig from "./IconConfig";

export default class ConfigAdmin extends Component {
  handleConfigToShow = (mainContent) => {
    switch (mainContent) {
      case "Inicio":
        return (
          <Config globalProps={this.props.globalProps} func={this.props.func} />
        );
      case "Login":
        return (<div> Modal en desarrollo</div>)
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
