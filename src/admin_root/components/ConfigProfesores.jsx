import React, { Component } from "react";
import "../css/configprofesores.css";

export default class ConfigProfesores extends Component {
  state = {
    aux: "2",
  };
  handleSelect = (event) => {
    this.setState({aux: event.target.value})
    this.props.func(event.target.value);
  }
  render() {
    return (
      <div className="config-modal__profesores">
        <h3>Configuracion</h3>
        <div>
          <label htmlFor="images">Mostrar</label>
          <select
            id="images"
            value={this.state.aux}
            onChange={this.handleSelect}
          >
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
        <button>Aplicar</button>
      </div>
    );
  }
}
