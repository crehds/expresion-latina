import { Component } from 'react';
import PropTypes from 'prop-types';
import './css/profesores.css';
import ProfileProfesorModal from './components/ProfileProfesorModal';
import ProfesoresCarousel from './components/ProfesoresCarousel';

export default class Profesores extends Component {
  constructor(props) {
    super(props);
    this.state = {
      profile: false,
      src: '',
      profesor: '',
      genero: '',
      carousel: [],
      carouselImagesStructure: 4,
      idProfesor: null,
      profesors: null,
    };
  }

  componentDidMount() {
    const { getFunction } = this.props;
    this.GettingAllImageProfesors();
    getFunction(this.handleCarouselImagesStructure);
  }

  componentWillUnmount() {
    const { handleLoading } = this.props;
    handleLoading();
  }

  handleCarouselImagesStructure = (structure) => {
    this.GettingAllImageProfesors(parseInt(structure, 10));
    this.setState({ carouselImagesStructure: structure });
  };

  GettingAllImageProfesors = async (
    { carouselImagesStructure: size } = this.state,
  ) => {
    const imagesProfesors = await fetch('/admin/getAllPathsImagesProfesors', {
      method: 'GET',
    }).then((result) => result.json());
    const { length } = imagesProfesors.data;
    const carousel = [];
    for (let i = 0; i < length; i += size) {
      carousel.push(imagesProfesors.data.slice(i, i + size));
    }

    this.setState({
      profesors: imagesProfesors.data,
      carousel,
    });
  };

  showProfile = () => {
    const { profile } = this.state;
    if (profile) {
      return this.setState({
        profile: false,
        src: '',
        profesor: '',
        genero: '',
      });
    }
    return this.setState({
      profile: true,
    });
  };

  handleProfile = (event) => {
    const { profesors } = this.state;
    const element = event.target.id;
    const profesorId = parseInt(element.match(/\d+/)[0], 10);
    const profesor = profesors.find(
      (e) => e.idProfesor === profesorId,
    );
    this.setState({
      src: profesor.ruta_imageProfesor,
      profesor: `${profesor.nombre} ${profesor.apellido}`,
      idProfesor: profesor.idProfesor,
      genero: 'No definido',
    });
    this.showProfile();
  };

  render() {
    const {
      src,
      idProfesor,
      profesor,
      genero,
      carousel,
      carouselImagesStructure,
      profile,
    } = this.state;

    return (
      <div className="profesores">
        <ProfesoresCarousel
          handleProfile={this.handleProfile}
          carousel={carousel}
          carouselImagesStructure={carouselImagesStructure}
        />
        {profile && (
          <ProfileProfesorModal
            showProfile={this.showProfile}
            idProfesor={idProfesor}
            src={src}
            profesor={profesor}
            genero={genero}
          />
        )}
      </div>
    );
  }
}

Profesores.propTypes = {
  getFunction: PropTypes.func.isRequired,
  handleLoading: PropTypes.func.isRequired,
};
