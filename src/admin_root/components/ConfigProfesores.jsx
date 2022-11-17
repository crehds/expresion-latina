import { Component } from 'react';
import PropTypes from 'prop-types';
import '../css/configprofesores.css';

export default class ConfigProfesores extends Component {
  constructor(props) {
    super(props);
    this.state = {
      aux: '2',
    };
  }

  handleSelect = (event) => {
    const { func } = this.props;
    this.setState({ aux: event.target.value });
    func(event.target.value);
  };

  render() {
    const { aux } = this.state;
    return (
      <div className="config-modal__profesores">
        <h3>Configuracion</h3>
        <div>
          <label htmlFor="images">
            <p>Mostrar</p>
            <select
              id="images"
              value={aux}
              onChange={this.handleSelect}
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
        </div>
        <button type="submit">Aplicar</button>
      </div>
    );
  }
}

ConfigProfesores.propTypes = {
  func: PropTypes.func.isRequired,
};
