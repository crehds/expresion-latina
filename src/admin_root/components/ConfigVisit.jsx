import { Component } from 'react';
import PropTypes from 'prop-types';
import AdminContainer from './AdminContainer';
import ConfigLogin from './ConfigLogin';
import IconConfig from './IconConfig';

// Temporal
// Se espera que a futuro la lógica cambie y se diferencia del config de Estudiante
export default class ConfigVisit extends Component {
  handleConfigToShow = (mainContent) => {
    const {
      handleDisplayConfig, display, unLogged, func,
    } = this.props;
    switch (mainContent) {
      case 'Login':
        return (
          <AdminContainer>
            <IconConfig handleDisplayConfig={handleDisplayConfig} />
            {display && (
              <ConfigLogin
                func={func}
                unLogged={unLogged}
              />
            )}
          </AdminContainer>
        );

      default:
        return <div />;
    }
  };

  render() {
    const { mainContent } = this.props;
    return this.handleConfigToShow(mainContent);
  }
}

ConfigVisit.propTypes = {
  handleDisplayConfig: PropTypes.func.isRequired,
  mainContent: PropTypes.string.isRequired,
  unLogged: PropTypes.func.isRequired,
  func: PropTypes.func.isRequired,
  display: PropTypes.bool.isRequired,
};
