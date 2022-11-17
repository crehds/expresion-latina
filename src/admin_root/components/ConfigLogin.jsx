import { Component } from 'react';
import PropTypes from 'prop-types';
import '../css/configlogin.css';

export default class ConfigLogin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      disabled: true,
    };
  }

  handleDisabledInput = () => {
    const { disabled } = this.state;
    this.setState({ disabled: !disabled });
  };

  render() {
    const { func, unLogged } = this.props;
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button type="button" onClick={this.handleDisabledInput}>Editar</button>
        <button type="button" onClick={func}>Guardar</button>
        <button type="button" onClick={unLogged}>Salir</button>
      </div>
    );
  }
}

ConfigLogin.propTypes = {
  func: PropTypes.func.isRequired,
  unLogged: PropTypes.func.isRequired,
};
