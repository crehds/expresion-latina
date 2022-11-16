import React from 'react';
import '../css/mainContainer.css';
export default function MainContainer(props) {
  return <main className='main-container'>{props.children}</main>;
}
