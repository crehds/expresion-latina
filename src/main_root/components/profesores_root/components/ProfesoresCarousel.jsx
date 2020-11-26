import React, { Component } from "react";
import Profesor from "./Profesor";
import Arrow from "./Arrow";

export default class ProfesoresCarousel extends Component {
  state = {
    carouselId: 0,
  };

  handleArrow = (event) => {
    let direction = event.target.id;

    const { carousel } = this.props;
    const { carouselId } = this.state;
    console.log(carousel);
    if (direction === "left") {
      if (carouselId === 0) {
        return this.setState({
          carouselId: carousel.length - 1,
        });
      }
      return this.setState({
        carouselId: carouselId - 1,
      });
    } else {
      if (carouselId === carousel.length - 1) {
        return this.setState({
          carouselId: 0,
        });
      }
      return this.setState({
        carouselId: carouselId + 1,
      });
    }
  };

  componentDidUpdate(prevProps) {
    if (this.props.carousel !== prevProps.carousel) {
      console.log("actualizado");
    }
  }
  render() {
    const { carouselId } = this.state;
    let { carousel, carouselImagesStructure, handleProfile } = this.props;
    return (
      <React.Fragment>
        {carousel[carouselId] && (
          <div
            className={`div-container-profesor-${
              carouselImagesStructure === carousel[carouselId].length
                ? carouselImagesStructure
                : carousel[carouselId].length
            }`}
          >
            {carousel[carouselId].map((e, i) => (
              <Profesor
                handleProfile={handleProfile}
                id={e.idProfesor}
                src={e.ruta_imageProfesor}
                key={i}
                profesor={e.nombre + e.apellido}
              />
            ))}
            <Arrow handleArrow={this.handleArrow} />
          </div>
        )}
      </React.Fragment>
    );
  }
}
