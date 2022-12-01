import { createPortal } from 'react-dom';

import './css/modal.css';

const modal = document.getElementById('modal');

function Modal({ children }) {
  return createPortal(<div className="modal">{children}</div>, modal);
}

export default Modal;
