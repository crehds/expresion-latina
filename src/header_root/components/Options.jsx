import React from "react";
import '../css/options.css';

export default function Options(props) {
  return (
    <ul className="options">
      <li id="Inicio" onClick={props.sendContent}>
        Inicio
      </li>
      <li id="Profesores" onClick={props.sendContent}>
        Profesores
      </li>
      <li id="Videos" onClick={props.sendContent}>
        Videos
      </li>
      <li id="Contact" onClick={props.sendContent}>
        Encuentranos
      </li>
      <li>Opción N</li>
    </ul>
  );
}
