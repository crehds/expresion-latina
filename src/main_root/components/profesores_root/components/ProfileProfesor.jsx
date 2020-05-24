import React, { Component } from 'react'
import '../css/profileProfesor.css';

export default class ProfileProfesor extends Component {

  render() {
    return (
      <div className="profile-profesor">
        <div className="profile-title">
        <h3>{this.props.genero}</h3>
          <i className="icon-x x" onClick={this.props.showProfile}></i>
        </div>
        <div className="profesor-image">
          <img src={this.props.src} alt={this.props.profesor}/>
        </div>
        <div className="profesor-description">Descripción</div>
      </div>
    )
  }
}