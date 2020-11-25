import React, { Component } from "react";
import "./css/profesores.css";
import ProfileProfesorModal from "./components/ProfileProfesorModal";
import ProfesoresCarousel from "./components/ProfesoresCarousel";
// import profesores from "../../../api/profesores.json";

export default class Profesores extends Component {
  state = {
    profile: false,
    src: "",
    profesor: "",
    genero: "",
    carousel: [],
    carouselImagesStructure: 4,
    idProfesor: null,
    profesors: null,
  };

  handleProfile = (event) => {
    let element = event.target.id;
    let profesorId = parseInt(element.match(/\d+/)[0]);
    let profesor = this.state.profesors.find(
      (e) => e.idProfesor === profesorId
    );
    this.setState({
      src: profesor.ruta_imageProfesor,
      profesor: profesor.nombre + " " + profesor.apellido,
      idProfesor: profesor.idProfesor,
      genero: "No definido",
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

  GettingAllImageProfesors = async (size = this.state.carouselImagesStructure) => {
    const imagesProfesors = await fetch("/admin/getAllPathsImagesProfesors", {
      method: "GET",
    }).then((result) => result.json());
    console.log(imagesProfesors.data);
    let length = imagesProfesors.data.length;
    let carousel = [];
    for (let i = 0; i < length; i = i + size) {
      console.log(i+size);
      carousel.push(imagesProfesors.data.slice(i, i + size));
      console.log(imagesProfesors.data.slice(i, i + size));
    }

    this.setState({
      profesors: imagesProfesors.data,
      carousel,
    });
  };
  handleCarouselImagesStructure = (structure) => {
    console.log(structure);
    this.GettingAllImageProfesors(parseInt(structure))
    this.setState({ carouselImagesStructure: structure });
  };

  componentDidMount() {
    // this.testGettingImage();
    this.GettingAllImageProfesors();
    this.props.getFunction(this.handleCarouselImagesStructure);
  }

  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    const { src, idProfesor, profesor, genero, carousel } = this.state;

    return (
      <div className="profesores">
        <ProfesoresCarousel
          handleProfile={this.handleProfile}
          carousel={carousel}
          carouselImagesStructure={this.state.carouselImagesStructure}
        />
        {this.state.profile && (
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
