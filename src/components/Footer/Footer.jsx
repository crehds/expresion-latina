import { studio, whatsappLink } from '../../data';

import './css/footer.css';

/*
 * The footer every page ends on.
 *
 * It used to be two social icons on a black bar. On a phone that is the last
 * thing a visitor sees on a page that often has room to spare below the
 * content, and it answered none of the questions someone reaches the bottom
 * of a dance academy's site still holding: where is it, and how do I write to
 * them. Those are here now, as links a thumb can act on rather than text to
 * copy out by hand.
 *
 * Every field but the name is nullable in the schema, so each one is checked
 * before it is rendered; a studio with no WhatsApp loses that line, not the
 * footer.
 */
export default function Footer() {
  const { address, city, country } = studio;
  const place = [address, city, country].filter(Boolean).join(', ');
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : null;

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__block">
          <p className="text-sm footer__name">{studio.name}</p>
          {mapsUrl && (
            /* No pin in the icon font, and an approximate glyph would say
               something the set does not mean. The line is the label. */
            <a className="text-sm footer__link" href={mapsUrl} target="_blank" rel="noreferrer">
              {place}
            </a>
          )}
        </div>

        <div className="footer__block">
          {whatsappLink && (
            <a
              className="text-sm footer__link"
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
            >
              <i className="icon-whatsapp footer__icon" aria-hidden="true" />
              {studio.whatsapp}
            </a>
          )}
          {studio.email && (
            <a className="text-sm footer__link" href={`mailto:${studio.email}`}>
              <i className="icon-envelope footer__icon" aria-hidden="true" />
              {studio.email}
            </a>
          )}
        </div>

        <ul className="footer__social">
          {studio.social?.facebook && (
            <li>
              <a
                className="footer__social-link"
                href={studio.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Expresión Latina en Facebook"
              >
                <i className="icon-facebook-square" aria-hidden="true" />
              </a>
            </li>
          )}
          {studio.social?.instagram && (
            <li>
              <a
                className="footer__social-link"
                href={studio.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Expresión Latina en Instagram"
              >
                <i className="icon-instagram" aria-hidden="true" />
              </a>
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
