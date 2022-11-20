import PropTypes from 'prop-types';
import '../css/profilebody.css';

export default function ProfileBody(props) {
  const {
    profile: user,
    socialMedia,
    handleChange,
    addOrUpdate,
    handleInputChecked,
    handleInfoUserSocialMedias,
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
          <i
            className="icon3-info"
            onClick={handleInfoUserSocialMedias}
            onKeyDown={handleInfoUserSocialMedias}
            role="button"
            tabIndex={0}
            aria-label="info-icon"
          />
        </h4>
        <div className="profile-social-media__container">
          <label htmlFor="red-social-1">
            {/* eslint-disable-next-line */}
            <a
              href={facebook.link || '#'}
              target={facebook.link ? '_blank' : undefined}
              rel="noopener noreferrer"
              className={`icon-facebook2 icon-social-profile ${facebook.link ? 'with-data' : 'without-data'}`}
            >
            </a>
          </label>
          <div className="profile-icon-input__container">
            <i
              id="facebook-1"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="facebook-icon"
            />
            <input
              type="checkbox"
              name="facebook"
              id="red-social-1"
              checked={facebook.estado}
              onChange={handleInputChecked}
            />
          </div>
        </div>
        <div className="profile-social-media__container">
          <a
            href={twitter.link || '#'}
            target={twitter.link ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            <i className={`icon-twitter icon-social-profile ${twitter.link ? 'with-data' : 'without-data'}`} />
          </a>
          <div className="profile-icon-input__container">
            <i
              id="twitter-2"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="twitter-icon"
            />
            <input
              type="checkbox"
              name="twitter"
              id="red-social-2"
              checked={twitter.estado}
              onChange={handleInputChecked}
            />
          </div>
        </div>
        <div className="profile-social-media__container">
          <a
            href={instagram.link || '#'}
            target={instagram.link ? '_blank' : undefined}
            rel="noopener noreferrer"
          >
            <i className="icon-instagram icon-social-profile without-data" />
          </a>
          <div className="profile-icon-input__container">
            <i
              id="instagram-3"
              className="icon3-edit-pencil"
              onClick={addOrUpdate}
              onKeyDown={addOrUpdate}
              role="button"
              tabIndex={0}
              aria-label="instagram-icon"
            />
            <input
              type="checkbox"
              name="instagram"
              id="red-social-3"
              checked={instagram.estado}
              onChange={handleInputChecked}
            />
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
  handleInputChecked: PropTypes.func.isRequired,
  handleInfoUserSocialMedias: PropTypes.func.isRequired,
};
