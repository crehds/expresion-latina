import React from 'react';
import '../css/arrow.css';

export default function Arrow(props) {
  return (
    <React.Fragment>
      <div className='arrow-container left'>
        <i
          id='left'
          className='icon-keyboard_arrow_left'
          onClick={props.handleArrow}
        ></i>
      </div>
      <div className='arrow-container right'>
        <i
          id='right'
          className='icon-keyboard_arrow_right'
          onClick={props.handleArrow}
        ></i>
      </div>
    </React.Fragment>
  );
}
