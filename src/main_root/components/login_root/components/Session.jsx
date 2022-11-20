import PropTypes from 'prop-types';
import '../css/session.css';

export default function Session(props) {
  const { findUser, handleStateLogin } = props;
  return (
    <form onSubmit={findUser} className="session-form">
      <fieldset>
        <legend>Conéctate</legend>
        <input
          id="session-usuario"
          type="text"
          name="usuario"
          placeholder="Usuario"
        />
        <input
          id="session-password"
          type="password"
          name="password"
          placeholder="Contraseña"
        />
        <div className="form-session-buttons">
          <button className="form-button" type="submit">
            Iniciar Sesión
          </button>
          <button
            id="Register"
            className="form-button"
            onClick={handleStateLogin}
            type="button"
          >
            Crea una cuenta
          </button>
        </div>
      </fieldset>
    </form>
  );
}

Session.propTypes = {
  findUser: PropTypes.func.isRequired,
  handleStateLogin: PropTypes.func.isRequired,
};
