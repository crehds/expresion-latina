import React from 'react';
import '../css/online.css';
import Swal from 'sweetalert2';
// import "@sweetalert2/theme-borderless/borderless.css"

function copyText(event) {
  let element = `prueba-${event.target.id}`;
  let input = document.createElement('input');
  input.id = `input-${element}`;
  input.value = document.getElementById(element).firstChild.innerHTML;

  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, 99999);
  document.execCommand('copy');
  Swal.fire({
    title: 'Copiado',
    text: input.value,
    background: 'rgb(56,71,94)',
    customClass: {
      title: 'swal-custom-title',
      content: 'swal-custom-content'
    }
  });
  document.body.removeChild(input);
}

function gradientMouse(event) {
  const online = document.getElementById('online2');
  let windowWidth = window.innerWidth;
  let windowHeight = window.innerHeight;

  let mouseXpercentage = Math.round(
    (event.changedTouches[0].pageX / windowWidth) * 100
  );
  let mouseYpercentage = Math.round(
    (event.changedTouches[0].pageY / windowHeight) * 100
  );

  online.style.backgroundImage = `radial-gradient(circle farthest-corner at ${mouseXpercentage}% ${mouseYpercentage}%, rgba(160,160,160,1), rgba(240,240,240,1) )`;
  // $('.radial-gradient').css('background', 'radial-gradient(at ' + mouseXpercentage + '% ' + mouseYpercentage + '%, #3498db, #9b59b6)');
}

export default function Online() {
  return (
    <div id='online2' className='online' onTouchMove={gradientMouse}>
      <ul className='prueba'>
        <li className='prueba2'>
          <i className='icon3-whatsapp'></i>
        </li>
        <li className='prueba2'>
          <i className='icon3-phone2'></i>
        </li>
        <li className='prueba2'>
          <i className='icon3-gmail'></i>
        </li>
      </ul>
      <ul className='prueba'>
        <li id='prueba-1' className='prueba2'>
          <span>984578125</span>
          <i id='1' className='icon-content_copy copy' onClick={copyText}></i>
        </li>
        <li id='prueba-2' className='prueba2'>
          <span>578125</span>
          <i id='2' className='icon-content_copy copy' onClick={copyText}></i>
        </li>
        <li id='prueba-3' className='prueba2'>
          <span>expresionlatina@gmail.com</span>
          <i id='3' className='icon-content_copy copy' onClick={copyText}></i>
        </li>
      </ul>
    </div>
  );
}
