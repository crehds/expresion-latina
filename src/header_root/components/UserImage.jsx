import React from 'react';
import '../css/userimage.css';

export default function UserImage(props) {
  return (
    <div className='userimage'>
      <img src={process.env.PUBLIC_URL + '/profile/default-user.png'} alt='' />
    </div>
  );
}
