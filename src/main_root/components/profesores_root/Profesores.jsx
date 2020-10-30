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
    test:null
  };

  handleProfesors = (profesores) => {
    let length = profesores.length;
    let carousel = [];
    for (let i = 0; i <= length; i = i + 4) {
      carousel.push(profesores.slice(i, i + 4));
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

  testGettingImage = async () => {
    const imagePath = await fetch("/admin/imageProfesor/3", {
      method: "GET"
    }).then(result => result.json());
    console.log(...imagePath.data);
    const ruta = imagePath.data[0].ruta_imageProfesor
    console.log(ruta);
    this.setState({test:ruta})
  }

  componentDidMount() {
    this.handleProfesors(profesores.images);
    this.testGettingImage();
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
        />
        {this.state.test && <div className="imageProfesor-prueba">
          <img src={"http://localhost:4000"+this.state.test} alt=""/>
        </div>}
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
