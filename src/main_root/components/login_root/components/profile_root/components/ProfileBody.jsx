import PropTypes from 'prop-types';
import '../css/profilebody.css';

export default function ProfileBody(props) {
  const {
    profile: user, socialMedia, handleChange, addOrUpdate,
  } = props;
  const { twitter, facebook, instagram } = socialMedia;
  return (
    <div className="profile-body">
      <div className="profile-body__datos">
        <h4>Datos Personales</h4>
        <div className="profile-body__datos-row">
          <label htmlFor="profile-nombre">
            <p>Nombres</p>
            <input
              id="profile-nombre"
              type="text"
              name="nombre"
              value={user.name || user.nombre}
              disabled
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="profile-body__datos-row">
          <label htmlFor="profile-apellidos">
            <p>Apellidos</p>
            <input
              id="profile-apellidos"
              type="text"
              name="apellido"
              value={user.lastname || user.apellido}
              disabled
              onChange={handleChange}
            />
          </label>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="profile-telefono">
            <p>Teléfono</p>
            <input
              id="profile-telefono"
              type="text"
              name="telefono"
              value={user.telefono}
              disabled
              onChange={handleChange}
            />
          </label>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="profile-edad">
            <p>Edad</p>
            <input
              id="profile-edad"
              type="text"
              name="edad"
              value={user.edad || user.fechaNacimiento}
              disabled
              onChange={handleChange}
            />
          </label>
        </div>
        <div className="profile-body__datos-row">
          <label htmlFor="profile-email">
            <p>Correo</p>
            <input
              type="text"
              name="email"
              value={user.email}
              disabled
              onChange={handleChange}
            />
          </label>
        </div>
      </div>
      <div className="profile-body__social-media">
        <h4 className="profile-body__social-media-title">
          Redes Sociales
          <i className="icon3-info" />
        </h4>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-1">
            {/* eslint-disable-next-line */}
            <a
              href={facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-facebook2 icon-social-profile"
            >
            </a>
          </label>
          <div>
            <i
              id="facebook"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="facebook-icon"
            />
            <input type="checkbox" name="facebook" id="red-social-1" />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-2">
            {/* eslint-disable-next-line */}
            <a
              href={twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-twitter icon-social-profile"
            >
            </a>
          </label>
          <div>
            <i
              id="twitter"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="twitter-icon"
            />
            <input type="checkbox" name="twitter" id="red-social-2" />
          </div>
        </div>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-3">
            {/* eslint-disable-next-line */}
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-instagram icon-social-profile"
            >
            </a>
          </label>
          <div>
            <i
              id="instagram"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="instagram-icon"
            />
            <input type="checkbox" name="instagram" id="red-social-3" />
          </div>
        </div>
      </div>
      <div className="profile-body__description">
        <textarea defaultValue="Frase o comentario que quieras que te describa" />
      </div>
    </div>
  );
}

ProfileBody.propTypes = {
  profile: PropTypes.instanceOf(Object).isRequired,
  socialMedia: PropTypes.instanceOf(Object).isRequired,
  handleChange: PropTypes.func.isRequired,
  addOrUpdate: PropTypes.func.isRequired,
};
