import React, { PureComponent } from "react";
import { createPortal } from "react-dom";
import ProfileProfesor from "./ProfileProfesor";

export default class ProfileProfesorModal extends PureComponent {
  render() {
    const { showProfile, src, idProfesor, profesor, genero } = this.props;
    return createPortal(
      <ProfileProfesor
        showProfile={showProfile}
        idProfesor={idProfesor}
        src={src}
        profesor={profesor}
        genero={genero}
      />,
      document.getElementById("modal")
    );
  }
}
