import { Component } from 'react';
import PropTypes from 'prop-types';
import AdminContainer from './AdminContainer';
import Config from './Config';
import ConfigLogin from './ConfigLogin';
import ConfigProfesores from './ConfigProfesores';
import IconConfig from './IconConfig';

export default class ConfigAdmin extends Component {
  handleConfigToShow = (mainContent) => {
    const { func, globalProps, unLogged } = this.props;
    switch (mainContent) {
      case 'Inicio':
        return (
          <Config globalProps={globalProps} func={func} />
        );
      case 'Login':
        return (
          <ConfigLogin func={func} unLogged={unLogged} />
        );
      case 'Profesores':
        return <ConfigProfesores func={func} />;
      default:
        return <div />;
    }
  };

  render() {
    const {
      display, mainContent, handleDisplayConfig,
    } = this.props;
    return (
      <AdminContainer>
        <IconConfig handleDisplayConfig={handleDisplayConfig} />
        {display && this.handleConfigToShow(mainContent)}
      </AdminContainer>
    );
  }
}

ConfigAdmin.propTypes = {
  globalProps: PropTypes.instanceOf(Array).isRequired,
  unLogged: PropTypes.func.isRequired,
  func: PropTypes.func.isRequired,
  display: PropTypes.bool.isRequired,
  handleDisplayConfig: PropTypes.func.isRequired,
  mainContent: PropTypes.string.isRequired,
};
