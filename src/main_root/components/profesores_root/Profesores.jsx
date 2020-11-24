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
    profesors: null,
  };

  handleProfile = (event) => {
    let element = event.target.id;
    let profesorId = parseInt(element.slice(-1));
    let profesor = this.state.profesors.find(
      (e) => e.idProfesor === profesorId
    );
    this.setState({
      src: profesor.ruta_imageProfesor,
      profesor: profesor.nombre + " " + profesor.apellido,
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

  // testGettingImage = async () => {
  //   const imagePath = await fetch("/admin/imageProfesor/3", {
  //     method: "GET",
  //   }).then((result) => result.json());
  //   console.log(...imagePath.data);
  //   const ruta = imagePath.data[0].ruta_imageProfesor;
  //   console.log(ruta);
  //   this.setState({ test: ruta });
  // };

  GettingAllImageProfesors = async () => {
    const imagesProfesors = await fetch("/admin/getAllPathsImagesProfesors", {
      method: "GET",
    }).then((result) => result.json());
    console.log(imagesProfesors.data);
    let length = imagesProfesors.data.length;
    let carousel = [];
    for (let i = 0; i <= length; i = i + 4) {
      carousel.push(imagesProfesors.data.slice(i, i + 4));
    }

    this.setState({
      profesors: imagesProfesors.data,
      carousel,
    });
  };
  componentDidMount() {
    // this.testGettingImage();
    this.GettingAllImageProfesors();
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
          carousel={carousel}
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
