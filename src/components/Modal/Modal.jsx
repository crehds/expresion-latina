import { createPortal } from 'react-dom';

import './css/modal.css';

const HOST_ID = 'modal';

/**
 * The portal host, resolved when a modal is first opened rather than when this
 * module is imported.
 *
 * Reading it at import time made the lookup depend on load order: the module
 * happens to be imported after index.html has parsed today, but a test, a
 * different entry point, or an earlier import all resolve it to null, and
 * createPortal then throws "Target container is not a DOM element" and takes
 * the page down. Creating the host when it is missing removes the dependency
 * on the markup entirely.
 */
function getHost() {
  const existing = document.getElementById(HOST_ID);

  if (existing) return existing;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  return host;
}

function Modal({ children }) {
  return createPortal(<div className="modal">{children}</div>, getHost());
}

export default Modal;
