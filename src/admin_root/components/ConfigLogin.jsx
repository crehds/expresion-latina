import { Component } from 'react';
import PropTypes from 'prop-types';
import '../css/configlogin.css';

// function getInputstag() {
//   const inputs = [
//     ...document.querySelectorAll('input[type=text],input[type=date]'),
//   ];
//   const divsIcons = [
//     ...document.getElementsByClassName('profile-icon-input__container'),
//   ];
//   for (const i of inputs) {
//     i.disabled = !i.disabled;
//   }
//   for (const div of divsIcons) {
//     div.style.display === 'block' && (div.style.display = 'none');
//   }
// }

export default class ConfigLogin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      inputsValue: [],
      saveButton: false,
    };
  }

  componentWillUnmount() {
    this.setState({
      inputsValue: [],
      saveButton: false,
    });
  }

  handleSaveInputs = (event) => {
    event.preventDefault();
    const { func } = this.props;
    // getInputstag();
    func();
    return this.setState({
      inputsValue: [],
      saveButton: false,
    });
  };

  editInputstag = () => {
    const { inputsValue, saveButton } = this.state;
    const inputs = [
      ...document.querySelectorAll('input[type=text],input[type=date]'),
    ];
    if (!saveButton) {
      const values = inputs.map((input) => input.value);
      this.setState({
        inputsValue: values,
        saveButton: true,
      });
    } else {
      for (let i = 0; i < inputs.length; i += 1) {
        inputs[i].value = inputsValue[i];
      }
      this.setState({
        inputsValue: [],
        saveButton: false,
      });
    }
    this.getInputstag();
  };

  render() {
    const { unLogged } = this.props;
    return (
      <div className="config-modal__login">
        <h3>Cuenta</h3>
        <button type="button" onClick={this.editInputstag}>Editar</button>
        <button type="button" onClick={this.handleSaveInputs}>Guardar</button>
        <button type="button" onClick={unLogged}>Salir</button>
      </div>
    );
  }
}

ConfigLogin.propTypes = {
  func: PropTypes.func.isRequired,
  unLogged: PropTypes.func.isRequired,
};
