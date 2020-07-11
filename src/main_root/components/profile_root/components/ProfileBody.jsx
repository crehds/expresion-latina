import React from "react";
import "../css/profilebody.css";

export default function ProfileBody(props) {
  return (
    <div className="profile-body">
      <div className="profile-body__datos">
        <h4>Datos Personales</h4>
        <div className="profile-body__datos-row">
          <label htmlFor="">Nombres</label>
          <input type="text" value="Marycarmen" disabled />
        </div>

        <div className="profile-body__datos-row">
          <label htmlFor="">Apellidos</label>
          <input type="text" value="Campos Velez" disabled />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Nickname</label>
          <input type="text" value="Señora de fernandez" disabled />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Correo</label>
          <input type="text" value="mary.fernandez@gmail.com" disabled />
        </div>
      </div>
      <div className="profile-body__social-media">
        <h4 className="profile-body__social-media-title">
          Redes Sociales<i className="icon3-info"></i>
        </h4>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-1">
            <i className="icon-facebook2 icon-social-profile"></i>
          </label>
          <div>
            <i className="icon3-edit-pencil"></i>
            <input type="checkbox" name="facebook" id="red-social-1" />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-2">
            <i className="icon-twitter icon-social-profile"></i>
          </label>
          <div>
            <i className="icon3-edit-pencil"></i>
            <input type="checkbox" name="twitter" id="red-social-2" />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-3">
            <i className="icon-instagram icon-social-profile"></i>
          </label>
          <div>
            <i className="icon3-edit-pencil"></i>
            <input type="checkbox" name="instagram" id="red-social-3" />
          </div>
        </div>
      </div>
      <div className="profile-body__description">
        <textarea defaultValue="Frase o comentario que quieras que te describa"></textarea>
      </div>
    </div>
  );
}
