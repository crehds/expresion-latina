import React from 'react';
import '../css/descriptionvideo.css';
export default function DescriptionVideo(props) {
  return (
    <div className='description-video'>
      <i
        className='icon-arrow-left3 arrow-description'
        onClick={props.toggleContent}
      ></i>
      <h3>{props.contentTitle}</h3>
    </div>
  );
}
