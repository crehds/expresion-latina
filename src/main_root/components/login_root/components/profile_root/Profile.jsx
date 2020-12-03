import React, { Component } from "react";
import "./css/profile.css";
import ProfileHead from "./components/ProfileHead";
import ProfileBody from "./components/ProfileBody";
// import ProfileFooter from "./components/ProfileFooter";
import Swal from "sweetalert2";

export default class Profile extends Component {
  state = {
    profile: { ...this.props.userRegistered.user },
    socialMedia: {
      facebook: {
        link: "",
        estado: 0,
      },
      twitter: {
        link: "",
        estado: 0,
      },
      instagram: {
        link: "",
        estado: 0,
      },
    },
  };

  handleChange = (e) => {
    console.log(e.target.value);
    this.setState({
      profile: {
        ...this.state.profile,
        [e.target.name]: e.target.value,
      },
    });
  };

  // convertAgeUser = (user) => {
    
  // };

  updateProfile = async () => {
    console.log(this.state.profile);
    const result = await fetch("/login/updateUser", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.state.profile),
    }).then((result) => result.json());
    console.log(result);
  };

  handleSaveUserProfileImage = async (event) => {
    event.preventDefault();
    console.log("aqui4");
    let form = document.getElementById("test__userimageprofile");
    const formData = new FormData(form);
    console.log(formData);
    const response = await fetch("/login/setPathUserProfileImage/1", {
      method: "PUT",
      body: formData,
    }).then((result) => result.json());
    console.log(response);
    this.setState({
      profile: {
        ...this.state.profile,
        old_imageProfile: this.state.profile.ruta_imageProfile,
      },
    });
    Swal.fire({
      title: "Foto Actualizada",
    });
  };

  addOrUpdate = (event) => {
    const socialMedia = /[A-z]+/.exec(event.target.id);
    const id = event.target.id.slice(-1);
    Swal.fire({
      title: "Ingresa el link",
      input: "text",
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return "No haz ingresado nada";
        }
      },
      showLoaderOnConfirm: true,
      preConfirm: (value) => {
        return fetch(
          `/login/updateUserSocialMedia/${this.state.profile.idUsuario}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              socialMediaId: id,
              link: value,
              estado: this.state.socialMedia[socialMedia].estado,
            }),
          }
        ).then(() => value);
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        this.setState({
          socialMedia: {
            ...this.state.socialMedia,
            [socialMedia]: {
              ...this.state.socialMedia[socialMedia],
              link: result.value,
            },
          },
        });
        Swal.fire({
          title: `${socialMedia} actualizado`,
        });
      }
    });
  };

  handleCancelInput = (event) => {
    console.log(this.state.profile);
    let inputCancel = document.getElementById("test__userimageprofile-input");
    inputCancel.value = "";
    this.handleInputCheck("none");
    return this.setState({
      profile: {
        ...this.state.profile,
        ruta_imageProfile: this.state.profile.old_imageProfile,
        old_imageProfile: "",
      },
    });
  };

  handleInput = (event) => {
    event.preventDefault();
    console.log(this.state.profile);
    let file = event.target.files[0];
    if (file) {
      this.handleInputCheck("block");
      let reader = new FileReader();
      let image = new Image();
      reader.readAsDataURL(file);
      reader.onload = () => {
        image.src = reader.result;
        this.setState((state) => {
          return state.profile.old_imageProfile
            ? {
                profile: {
                  ...state.profile,
                  ruta_imageProfile: image.src,
                },
              }
            : {
                profile: {
                  ...state.profile,
                  old_imageProfile: state.profile.ruta_imageProfile,
                  ruta_imageProfile: image.src,
                },
              };
        });
      };
    }
  };

  handleCheck = () => {
    let button = document.getElementById("button-profile-head-aux");
    this.handleInputCheck("none");
    return button.click();
  };

  handleInputCheck = (display) => {
    let inputCheck = document.getElementsByName("check");
    inputCheck[0].style.display = display;
    inputCheck[1].style.display = display;
  };

  getUserSocialMedias = async (userId) => {
    const socialMedias = await fetch(
      `/login/getUserSocialMedias/${userId}`
    ).then((result) => result.json());
    return this.setState((state) => {
      let obj = Object.assign({}, state.socialMedia);
      Object.keys(state.socialMedia).forEach((key, i) => {
        obj[key].link = socialMedias.data[i].link;
        obj[key].estado = socialMedias.data[i].estado;
      });
      return { socialMedia: obj };
    });
  };

  handleInputChecked = (event) => {
    let estado = event.target.checked;
    this.setState({
      socialMedia: {
        ...this.state.socialMedia,
        [event.target.name]: {
          ...this.state.socialMedia[event.target.name],
          estado,
        },
      },
    });
  };

  handleInfoUserSocialMedias = () => {
    Swal.fire({
      icon: "info",
      title: "Redes Sociales",
      text:
        "Al activar o desactivar el cuadrado(cerca al icono) controlaras que red social mostrar en tu perfil",
    });
  };

  componentDidMount() {
    this.getUserSocialMedias(this.state.profile.idUsuario);
    this.props.getFunction(this.updateProfile);
  }

  render() {
    return (
      <div className="profile">
        <ProfileHead
          profile={this.state.profile}
          handleSaveUserProfileImage={this.handleSaveUserProfileImage}
          handleInput={this.handleInput}
          handleCancelInput={this.handleCancelInput}
          handleCheck={this.handleCheck}
        />
        <ProfileBody
          profile={this.state.profile}
          handleChange={this.handleChange}
          addOrUpdate={this.addOrUpdate}
          getDataProfile={this.props.getDataProfile}
          gettingAgeUser={this.gettingAgeUser}
          socialMedia={this.state.socialMedia}
          handleInfoUserSocialMedias={this.handleInfoUserSocialMedias}
          handleInputChecked={this.handleInputChecked}
        />
      </div>
    );
  }
}
