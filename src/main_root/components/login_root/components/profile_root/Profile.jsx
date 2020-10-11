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
      facebook: "",
      twitter: "",
      instagram: "",
    },
  };

  handleChange = (e) => {
    this.setState({
      profile: {
        ...this.state.profile,
        [e.target.name]: e.target.value,
      },
    });
  };

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

  componentDidMount() {
    this.props.getFunction(this.updateProfile);
  }

  addOrUpdate = async (event) => {
    const id = event.target.id;
    console.log(id);
    const { value: link } = await Swal.fire({
      title: "Ingresa el link",
      input: "text",
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return "No haz ingresado nada";
        }
      },
    });
    this.setState({
      socialMedia: {
        ...this.state.socialMedia,
        [id]: link,
      },
    });
  };

  render() {
    console.log(this.state.twitter);
    return (
      <div className="profile">
        <ProfileHead profile={this.state.profile} />
        <ProfileBody
          profile={this.state.profile}
          handleChange={this.handleChange}
          addOrUpdate={this.addOrUpdate}
          getDataProfile={this.props.getDataProfile}
          socialMedia={this.state.socialMedia}
        />
      </div>
    );
  }
}
