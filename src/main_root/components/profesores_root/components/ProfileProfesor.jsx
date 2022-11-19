import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import '../css/profileProfesor.css';
import Swal from 'sweetalert2';

export default class ProfileProfesor extends PureComponent {
  handleInfoGenresProfesor = async () => {
    const { idProfesor } = this.props;
    const result = await fetch(
      `/admin/danceGenresProfesor/${idProfesor}`,
    ).then((response) => response.json());
    if (result.data.length !== 0) {
      Swal.fire({
        title: 'Géneros que el profesor domina:',
        text: result.data.join('-'),
      });
    } else {
      Swal.fire({
        title: 'Géneros que el profesor domina:',
        text: 'Se asignará pronto...',
      });
    }
  };

  render() {
    const { profesor, showProfile, src } = this.props;
    return (
      <div className="profile-profesor">
        <div className="profile-title">
          <h3>{profesor}</h3>
          <i
            className="icon-x x"
            onClick={showProfile}
            onKeyDown={showProfile}
            role="button"
            tabIndex={0}
            aria-label="x-icon"
          />
        </div>
        <div className="profesor-image">
          <img src={src} alt={profesor} />

          <div className="profesor-socialmedia">
            <i
              className="icon3-info infoGenres"
              onClick={this.handleInfoGenresProfesor}
              onKeyDown={this.handleInfoGenresProfesor}
              role="button"
              tabIndex={0}
              aria-label="info-genres-icon"
            />
            <i className="icon-facebook2 socialmedia" />
            <i className="icon-instagram socialmedia" />
            <i className="icon-twitter socialmedia" />
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

ProfileProfesor.propTypes = {
  idProfesor: PropTypes.number.isRequired,
  profesor: PropTypes.string.isRequired,
  showProfile: PropTypes.func.isRequired,
  src: PropTypes.string.isRequired,
};
