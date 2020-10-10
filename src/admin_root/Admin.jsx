import React from "react";
import { createPortal } from "react-dom";
import "./css/admin.css";
import ModalAdmin from "./components/ModalAdmin";
export default function Admin(props) {
  return createPortal(
    <ModalAdmin
      globalProps={props.globalProps}
      func={props.func}
      mainContent={props.maincontent}
      typeOfUser={props.typeOfUser}
      unLogged={props.unLogged}
    />,
    document.getElementById("administrador")
  );
}
