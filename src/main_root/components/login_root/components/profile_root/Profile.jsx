import React, { Component } from "react";
import "./css/profile.css";
import ProfileHead from "./components/ProfileHead";
import ProfileBody from "./components/ProfileBody";
// import ProfileFooter from "./components/ProfileFooter";

export default class Profile extends Component {
  state = {
    profile: { ...this.props.userRegistered.user },
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
    }).then(result => result.json());
    console.log(result);
  };

  componentDidMount() {
    this.props.getFunction(this.updateProfile)
  }

  render() {
    console.log();
    return (
      <div className="profile">
        <ProfileHead
          profile={this.state.profile}
        />
        <ProfileBody
          profile={this.state.profile}
          handleChange={this.handleChange}
          getDataProfile={this.props.getDataProfile}
        />
      </div>
    );
  }
}
