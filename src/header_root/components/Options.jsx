import React from 'react';
import '../css/options.css';

export default function Options(props) {
  return (
    <ul className='options'>
      <li id='Inicio' onClick={props.sendContent}>
        Inicio
      </li>
      <li id='Profesores' onClick={props.sendContent}>
        Profesores
      </li>
      <li id='Clases' onClick={props.sendContent}>
        Clases
      </li>
      <li id='Horario' onClick={props.sendContent}>
        Horario
      </li>
      <li id='Reseñas' onClick={props.sendContent}>
        Reseñas
      </li>
      <li id='Contacto' onClick={props.sendContent}>
        Encuentranos
      </li>
      <li id='Login' onClick={props.sendContent}>
        {props.profile ? 'Cuenta' : 'Conéctate'}
      </li>
      <li>Opción N</li>
    </ul>
  );
}
