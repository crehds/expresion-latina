import React, { Component } from "react";
import "../css/profileProfesor.css";
import Swal from "sweetalert2";
export default class ProfileProfesor extends Component {

  handleInfoGenresProfesor = async () => {
    console.log(this.props.idProfesor);
    const result = await fetch(`/admin/danceGenresProfesor/${this.props.idProfesor}`).then(result =>result.json())
    console.log(result);
    Swal.fire({
      title: "Géneros que el profesor domina:",
      text: result.data.map(e =>e.idGenero_baile).join("-")
    })
  }

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
          <i className="icon3-info infoGenres" onClick={this.handleInfoGenresProfesor}>
          </i>
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
