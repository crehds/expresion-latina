import React from 'react';
import '../css/video.css';
export default function Video(props) {
  return (
    <div className='video-box'>
      <div className='prueba4'>
        <video
          width='720px'
          height='480'
          src={process.env.PUBLIC_URL + props.src}
          controls
        ></video>
      </div>

      <div className='icon-video-container'>
        <i className='icon3-credit-card icon-video'></i>
        <i className='icon3-eye1 icon-video'></i>
        <i className='icon3-info icon-video'></i>
      </div>
    </div>
  );
}
