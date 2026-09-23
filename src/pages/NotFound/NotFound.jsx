import { Link } from 'react-router-dom';

import { Page } from '../../components';

import './css/not-found.css';

/**
 * Where an address the site does not have ends up.
 *
 * Without it those addresses rendered the nav and the footer with nothing
 * between them, which reads as a broken site rather than a wrong turn. The
 * case that makes it real rather than hypothetical is /reviews: that page
 * existed until opinions moved onto the landing page, so the address can
 * still be in somebody's bookmarks or in a search result.
 *
 * It offers the two places a visitor who mistyped is most likely heading for,
 * rather than only apologising.
 */
export default function NotFound() {
  return (
    <Page
      title="No encontramos esta página"
      lead="Puede que el enlace esté roto o que la página ya no exista."
      className="not-found"
    >
      <ul className="not-found__links">
        <li>
          <Link className="not-found__link" to="/">Ir al inicio</Link>
        </li>
        <li>
          <Link className="not-found__link" to="/schedules">Ver los horarios</Link>
        </li>
      </ul>
    </Page>
  );
}
