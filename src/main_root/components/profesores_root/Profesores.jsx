import React, { Component } from "react";
import "./css/profesores.css";
import ProfileProfesorModal from "./components/ProfileProfesorModal";
import ProfesoresCarousel from "./components/ProfesoresCarousel";
import profesores from "../../../api/profesores.json";

export default class Profesores extends Component {
  state = {
    profile: false,
    src: "",
    profesor: "",
    genero: "",
    carousel: [],
    carouselImagesStructure: 4,
  };

  handleProfesors = (profesores,size= this.state.carouselImagesStructure) => {
    let length = profesores.length;
    let carousel = [];
    for (let i = 0; i < length; i = i + size) {
      carousel.push(profesores.slice(i, i + size));
    }
    this.setState({
      carousel,
    });
  };

  handleProfile = (event) => {
    let element = event.target.id;
    let profesorId = element.slice(-1);
    let profesor = profesores.images.find((e) => e.id === profesorId);
    this.setState({
      src: profesor.src,
      profesor: profesor.profesor,
      genero: profesor.genero,
    });
    this.showProfile();
  };

  showProfile = () => {
    if (this.state.profile) {
      return this.setState({
        profile: false,
        src: "",
        profesor: "",
        genero: "",
      });
    } else {
      return this.setState({
        profile: true,
      });
    }
  };

  handleCarouselImagesStructure = (structure) => {
    console.log(structure);
    this.handleProfesors(profesores.images,parseInt(structure));
    this.setState({ carouselImagesStructure: structure });
  };

  componentDidMount() {
    this.handleProfesors(profesores.images);
    this.props.getFunction(this.handleCarouselImagesStructure);
  }

  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    const { src, profesor, genero, carousel } = this.state;

    return (
      <div className="profesores">
        <ProfesoresCarousel
          handleProfile={this.handleProfile}
          handleProfesors={this.handleProfesors}
          carousel={carousel}
          getFunction={this.props.getFunction}
          carouselImagesStructure={this.state.carouselImagesStructure}
        />
        {this.state.profile && (
          <ProfileProfesorModal
            showProfile={this.showProfile}
            src={src}
            profesor={profesor}
            genero={genero}
          />
        )}
      </div>
    );
  }
}
