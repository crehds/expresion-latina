import React from 'react';
import '../css/profilehead.css';
export default function ProfileHead(props) {
  const { profile: user } = props;
  return (
    <div className='profile-head'>
      <h4 className='profile-head__name'>{`${user.name || user.nombre} ${
        user.lastname || user.apellido
      }`}</h4>
      <div className='profile-head__container'>
        <img
          src={process.env.PUBLIC_URL + '/profile/default-user.png'}
          alt='foto del admin'
        />
      </div>
    </div>
  );
}
