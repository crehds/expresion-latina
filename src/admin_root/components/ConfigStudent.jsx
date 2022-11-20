import { Component } from 'react';
import PropTypes from 'prop-types';
import '../css/configstudent.css';
import ConfigLogin from './ConfigLogin';
import AdminContainer from './AdminContainer';
import IconConfig from './IconConfig';

export default class ConfigStudent extends Component {
  handleConfigToShow = (mainContent) => {
    const {
      display, func, handleDisplayConfig, unLogged,
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

ConfigStudent.propTypes = {
  handleDisplayConfig: PropTypes.func.isRequired,
  mainContent: PropTypes.string.isRequired,
  unLogged: PropTypes.func.isRequired,
  func: PropTypes.func.isRequired,
  display: PropTypes.bool.isRequired,
};
