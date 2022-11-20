import { Component } from 'react';
import PropTypes from 'prop-types';
import Profesor from './Profesor';
import Arrow from './Arrow';

export default class ProfesoresCarousel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      carouselId: 0,
    };
  }

  handleArrow = (event) => {
    const direction = event.target.id;

    const { carousel } = this.props;
    const { carouselId } = this.state;

    if (direction === 'left') {
      if (carouselId === 0) {
        return this.setState({
          carouselId: carousel.length - 1,
        });
      }
      return this.setState({
        carouselId: carouselId - 1,
      });
    }
    if (carouselId === carousel.length - 1) {
      return this.setState({
        carouselId: 0,
      });
    }
    return this.setState({
      carouselId: carouselId + 1,
    });
  };

  render() {
    const { carouselId } = this.state;
    const { carousel, carouselImagesStructure, handleProfile } = this.props;
    return (
      <div>
        {carousel[carouselId] && (
          <div
            className={`div-container-profesor-${
              carouselImagesStructure === carousel[carouselId].length
                ? carouselImagesStructure
                : carousel[carouselId].length
            }`}
          >
            {carousel[carouselId].map((e) => (
              <Profesor
                handleProfile={handleProfile}
                id={e.idProfesor}
                src={e.ruta_imageProfesor}
                key={`profesor-${e.id}`}
                profesor={e.nombre + e.apellido}
              />
            ))}
            <Arrow handleArrow={this.handleArrow} />
          </div>
        )}
      </div>

    );
  }
}

ProfesoresCarousel.propTypes = {
  carousel: PropTypes.instanceOf(Array).isRequired,
  carouselImagesStructure: PropTypes.number.isRequired,
  handleProfile: PropTypes.func.isRequired,
};
