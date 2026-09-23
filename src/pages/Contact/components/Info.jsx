import { studio, whatsappLink } from '../../../data';

import '../css/info.css';

function Info() {
  const {
    address, email, social, whatsapp,
  } = studio;

  return (
    <div className="info">
      <div className="info__content">
        <ul className="info__menu">
          {whatsappLink && (
            /*
             * Gated on the link, not on the raw cell. A cell can be non-empty
             * and still carry no number, and this row used to render an anchor
             * with no href for exactly those values: it looks like a link, and
             * is neither focusable, announced as one, nor tappable. The footer
             * and the hero already branch on the link; this was the call site
             * the module comment claimed they all did.
             */
            <li className="info__detail">
              <i className="icon-whatsapp" />
              {/* A tappable link beats a number to copy out by hand. */}
              <a className="text-sm info__link" href={whatsappLink} target="_blank" rel="noreferrer">
                {whatsapp}
              </a>
            </li>
          )}
          {email && (
            <li className="info__detail">
              <i className="icon-envelope" />
              <a className="text-sm info__link" href={`mailto:${email}`}>{email}</a>
            </li>
          )}
          {address && (
            // No location glyph exists in this icon set, so the line carries none.
            <li className="info__detail info__detail--address">
              <p className="text-sm">{address}</p>
            </li>
          )}
          {social?.instagram && (
            <li className="info__detail">
              <i className="icon-instagram" />
              <a className="text-sm info__link" href={social.instagram} target="_blank" rel="noreferrer">
                expresionlatina.peru
              </a>
            </li>
          )}
          {social?.facebook && (
            <li className="info__detail">
              <i className="icon-facebook-square" />
              <a className="text-sm info__link" href={social.facebook} target="_blank" rel="noreferrer">
                expresionlatina.peru
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Info;
