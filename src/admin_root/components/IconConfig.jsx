import React from 'react';
import '../css/iconconfig.css';

export default function IconConfig(props) {
  return (
    <i
      className='icon3-settings icon-modal-config'
      onClick={props.handleDisplayConfig}
    ></i>
  );
}
