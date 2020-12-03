import React from "react";
import "../css/profilebody.css";

export default function ProfileBody(props) {
  const { profile: user } = props;
  const { twitter, facebook, instagram } = props.socialMedia;
  return (
    <div className="profile-body">
      <div className="profile-body__datos">
        <h4>Datos Personales</h4>
        <div className="profile-body__datos-row">
          <label htmlFor="">Nombres</label>
          <input
            type="text"
            name="nombre"
            value={user.name || user.nombre}
            disabled
            onChange={props.handleChange}
          />
        </div>

        <div className="profile-body__datos-row">
          <label htmlFor="">Apellidos</label>
          <input
            type="text"
            name="apellido"
            value={user.lastname || user.apellido}
            disabled
            onChange={props.handleChange}
          />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Teléfono</label>
          <input
            type="text"
            name="telefono"
            value={user.telefono}
            disabled
            onChange={props.handleChange}
          />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Cumpleaños</label>
          <input
            type="date"
            name="fechaNacimiento"
            value={user.edad || user.fechaNacimiento}
            disabled
            onChange={props.handleChange}
          />
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="">Correo</label>
          <input
            type="text"
            name="email"
            value={user.email}
            disabled
            onChange={props.handleChange}
          />
        </div>
      </div>
      <div className="profile-body__social-media">
        <h4 className="profile-body__social-media-title">
          Redes Sociales
          <i
            className="icon3-info"
            onClick={props.handleInfoUserSocialMedias}
          ></i>
        </h4>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-1">
            {/* eslint-disable-next-line */}
            <a
              href={facebook.link || "#"}
              target={facebook.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`icon-facebook2 icon-social-profile ${facebook.link ?"with-data": "without-data"}`}
            ></a>
          </label>
          <div className="profile-icon-input__container">
            <i
              id="facebook-1"
              className="icon3-edit-pencil"
              onClick={props.addOrUpdate}
            ></i>
            <input
              type="checkbox"
              name="facebook"
              id="red-social-1"
              checked={facebook.estado}
              onChange={props.handleInputChecked}
            />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-2">
            {/* eslint-disable-next-line */}
            <a
              href={twitter.link || "#"}
              target={twitter.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`icon-twitter icon-social-profile ${twitter.link ?"with-data": "without-data"}`}
            ></a>
          </label>
          <div className="profile-icon-input__container">
            <i
              id="twitter-2"
              className="icon3-edit-pencil"
              onClick={props.addOrUpdate}
            ></i>
            <input
              type="checkbox"
              name="twitter"
              id="red-social-2"
              checked={twitter.estado}
              onChange={props.handleInputChecked}
            />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-3">
            {/* eslint-disable-next-line */}
            <a
              href={instagram.link || "#"}
              target={instagram.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="icon-instagram icon-social-profile without-data"
            ></a>
          </label>
          <div className="profile-icon-input__container">
            <i
              id="instagram-3"
              className="icon3-edit-pencil"
              onClick={props.addOrUpdate}
            ></i>
            <input
              type="checkbox"
              name="instagram"
              id="red-social-3"
              checked={instagram.estado}
              onChange={props.handleInputChecked}
            />
          </div>
        </div>
      </div>
      <div className="profile-body__description">
        <textarea defaultValue="Frase o comentario que quieras que te describa"></textarea>
      </div>
    </div>
  );
}
