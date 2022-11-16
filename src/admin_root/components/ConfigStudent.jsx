import React, { Component } from 'react';
import '../css/configstudent.css';
import ConfigLogin from './ConfigLogin';
import AdminContainer from './AdminContainer';
import IconConfig from './IconConfig';
export default class ConfigStudent extends Component {
  handleConfigToShow = (mainContent) => {
    switch (mainContent) {
      case 'Login':
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
