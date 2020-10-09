import React from "react";
import "../css/profilebody.css";

export default function ProfileBody(props) {
  const { user } = props.userRegistered;
  console.log(user);
  return (
    <div className="profile-body">
      <div className="profile-body__datos">
        <h4>Datos Personales</h4>
        <div className="profile-body__datos-row">
          <label htmlFor="">Nombres</label>
          <input type="text" value={user.name || user.nombre} disabled />
        </div>

        <div className="profile-body__datos-row">
          <label htmlFor="">Apellidos</label>
          <input type="text" value={user.lastname ||user.apellido}disabled />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Teléfono</label>
          <input type="text" value={user.telefono} disabled />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Edad</label>
          <input type="text" value={user.edad} disabled />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Correo</label>
          <input type="text" value={user.email} disabled />
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
