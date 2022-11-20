import PropTypes from 'prop-types';
import '../css/options.css';

export default function Options(props) {
  const { profile, sendContent } = props;
  return (
    <ul className="options">
      <li>
        <div
          id="Inicio"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Inicio
        </div>
      </li>
      <li>
        <div
          id="Profesores"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Profesores
        </div>
      </li>
      <li>
        <div
          id="Clases"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Clases
        </div>
      </li>
      <li>
        <div
          id="Horario"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Horario
        </div>
      </li>
      <li>
        <div
          id="Reseñas"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Reseñas
        </div>
      </li>
      <li>
        <div
          id="Contacto"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
        >
          Encúentranos
        </div>
      </li>
      <li>
        <div
          id="Login"
          onClick={sendContent}
          onKeyDown={sendContent}
          tabIndex={0}
          role="button"
          aria-label="profile"
        />
        {profile ? 'Cuenta' : 'Conéctate'}
      </li>
    </ul>
  );
}

Options.propTypes = {
  profile: PropTypes.bool.isRequired,
  sendContent: PropTypes.func.isRequired,
};
