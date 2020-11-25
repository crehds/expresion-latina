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
    // condicionales insertadas para evadir el valor inicial de ...............000undefined del carousel
    // En el componente padre es el subarreglo del carousel
    const { carouselId } = this.state;
    console.log(this.props.carousel);
    let aux = this.props.carousel[carouselId]
      ? this.props.carousel[carouselId].length
      : 4;
    return (
      <div className={`div-container-profesor-${aux}`}>
        {this.props.carousel[carouselId] &&
          this.props.carousel[carouselId].map((e,i) => (
            <Profesor
              handleProfile={this.props.handleProfile}
              id={e.idProfesor}
              src={e.ruta_imageProfesor}
              key={i}
              profesor={e.nombre + e.apellido}
            />
          ))}
        <Arrow handleArrow={this.handleArrow} />
      </div>
    );
  }
}
