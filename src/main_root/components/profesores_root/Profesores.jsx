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
    carousel2: [],
    test: null,
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

  testCarouselBD = () => {};
  handleProfile = (event) => {
    let element = event.target.id;
    let profesorId = parseInt(element.slice(-1));
    console.log(typeof profesorId);
    console.log(typeof this.state.test[0].idProfesor);
    let profesor = this.state.test.find((e) => e.idProfesor === profesorId);
    this.setState({
      src: "http://localhost:4000" + profesor.ruta_imageProfesor,
      profesor: profesor.nombre+ " " + profesor.apellido,
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

  testGettingImage = async () => {
    const imagePath = await fetch("/admin/imageProfesor/3", {
      method: "GET",
    }).then((result) => result.json());
    console.log(...imagePath.data);
    const ruta = imagePath.data[0].ruta_imageProfesor;
    console.log(ruta);
    this.setState({ test: ruta });
  };

  testGettingAllImage = async () => {
    const imagesProfesors = await fetch("/admin/getAllPathsImagesProfesors", {
      method: "GET",
    }).then((result) => result.json());
    console.log(imagesProfesors.data);
    // const arrayPaths = imagesPaths.data.map((e) => e.ruta_imageProfesor);
    let length = imagesProfesors.data.length;
    let carousel2 = [];
    for (let i = 0; i <= length; i = i + 4) {
      carousel2.push(imagesProfesors.data.slice(i, i + 4));
    }

    this.setState({
      test:imagesProfesors.data,
      carousel2,
    });
    // this.setState({ test: arrayPaths})

  };
  componentDidMount() {
    this.handleProfesors(profesores.images);
    // this.testGettingImage();
    this.testGettingAllImage();
  }

  componentWillUnmount() {
    this.props.handleLoading();
  }

  render() {
    const { src, profesor, genero, carousel, carousel2 } = this.state;

    return (
      <div className="profesores">
        <ProfesoresCarousel
          handleProfile={this.handleProfile}
          handleProfesors={this.handleProfesors}
          carousel={carousel}
          carousel2={carousel2}
        />
        {/* {this.state.test && <div className="imageProfesor-prueba">
          <img src={"http://localhost:4000"+this.state.test} alt=""/>
        </div>} */}
        {/* {this.state.test && (
          <div className="imagesProfesors-prueba-container">
            {this.state.test.map((e, i, a) => (
              <div className="imageProfesor-prueba2" key={i}>
                <img src={e} alt="" />
              </div>
            ))}
          </div>
        )} */}
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
