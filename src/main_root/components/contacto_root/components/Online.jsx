import '../css/online.css';
import Swal from 'sweetalert2';

function copyText(event) {
  const element = `prueba-${event.target.id}`;
  const input = document.createElement('input');
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
      content: 'swal-custom-content',
    },
  });
  document.body.removeChild(input);
}

function gradientMouse(event) {
  const online = document.getElementById('online2');
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const mouseXpercentage = Math.round(
    (event.changedTouches[0].pageX / windowWidth) * 100,
  );
  const mouseYpercentage = Math.round(
    (event.changedTouches[0].pageY / windowHeight) * 100,
  );

  online.style.backgroundImage = `radial-gradient(circle farthest-corner at ${mouseXpercentage}% ${mouseYpercentage}%, rgba(160,160,160,1), rgba(240,240,240,1) )`;
}

export default function Online() {
  return (
    <div id="online2" className="online" onTouchMove={gradientMouse}>
      <ul className="prueba">
        <li className="prueba2">
          <i className="icon3-whatsapp" />
        </li>
        <li className="prueba2">
          <i className="icon3-phone2" />
        </li>
        <li className="prueba2">
          <i className="icon3-gmail" />
        </li>
      </ul>
      <ul className="prueba">
        <li id="prueba-1" className="prueba2">
          <span>984578125</span>
          <i
            id="1"
            className="icon-content_copy copy"
            onClick={copyText}
            onKeyDown={copyText}
            aria-label="copy-icon"
            tabIndex={0}
            role="button"
          />
        </li>
        <li id="prueba-2" className="prueba2">
          <span>578125</span>
          <i
            id="2"
            className="icon-content_copy copy"
            onClick={copyText}
            onKeyDown={copyText}
            aria-label="copy-icon"
            tabIndex={0}
            role="button"
          />
        </li>
        <li id="prueba-3" className="prueba2">
          <span>expresionlatina@gmail.com</span>
          <i
            id="3"
            className="icon-content_copy copy"
            onClick={copyText}
            onKeyDown={copyText}
            aria-label="copy-icon"
            tabIndex={0}
            role="button"
          />
        </li>
      </ul>
    </div>
  );
}
