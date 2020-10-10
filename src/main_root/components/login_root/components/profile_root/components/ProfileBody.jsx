import React from "react";
import "../css/profilebody.css";

export default function ProfileBody(props) {
  const { profile:user } = props;
  return (
    <div className="profile-body">
      <div className="profile-body__datos">
        <h4>Datos Personales</h4>
        <div className="profile-body__datos-row">
          <label htmlFor="">Nombres</label>
          <input type="text" name="nombre" value={user.name || user.nombre} disabled onChange={props.handleChange} />
        </div>

        <div className="profile-body__datos-row">
          <label htmlFor="">Apellidos</label>
          <input type="text" name="apellido" value={user.lastname ||user.apellido}disabled onChange={props.handleChange}/>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Teléfono</label>
          <input type="text" name="telefono" value={user.telefono} disabled onChange={props.handleChange}/>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Edad</label>
          <input type="text" name="edad" value={user.edad} disabled onChange={props.handleChange}/>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Correo</label>
          <input type="text" name="email" value={user.email} disabled onChange={props.handleChange}/>
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
