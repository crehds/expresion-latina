import React, { Component } from "react";
import "../css/profileProfesor.css";

export default class ProfileProfesor extends Component {
  render() {
    return (
      <div className="profile-profesor">
        <div className="profile-title">
          <h3>{this.props.profesor}</h3>
          <i className="icon-x x" onClick={this.props.showProfile}></i>
        </div>
        <div className="profesor-image">
          <img
            src={this.props.src}
            alt={this.props.profesor}
          />
          <div className="profesor-socialmedia">
            <i className="icon-facebook2 socialmedia"></i>
            <i className="icon-instagram socialmedia"></i>
            <i className="icon-twitter socialmedia"></i>
          </div>
        </div>
        <div className="profesor-description">
          <div>Campeón...</div>
          <div>Bailarín Profesional...</div>
          <div>Instructor...</div>
        </div>
      </div>
    );
  }
}
