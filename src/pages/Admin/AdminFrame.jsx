import { NavLink, Outlet } from 'react-router-dom';

import Page from '../../components/Page/Page';
import KeepaliveBanner from '../../features/membership/ui/KeepaliveBanner';

import './css/admin-frame.css';

// The admin pages that exist, in the order the sub-navigation lists them. A page
// joins the list by being added here, next to the route that shows it.
const ADMIN_PAGES = [
  { to: '/admin/members', label: 'Miembros' },
  { to: '/admin/attendance', label: 'Asistencia' },
];

const linkClass = ({ isActive }) => (
  isActive ? 'admin-frame__link admin-frame__link--active' : 'admin-frame__link'
);

/**
 * The frame every admin page shares (Design: D10): the heading of the area, the
 * sub-navigation between the admin pages, and the room above the page for what
 * concerns all of them.
 *
 * It is the element of a layout route, and `Outlet` is where the page of the
 * current route goes. The route sits behind the admin guard, so the frame never
 * renders for anyone else, and each page brings only its own content (a
 * section with a level 2 heading) and never a heading or a landmark of its own.
 *
 * The keep-alive notice, which tells the administrator that the project has not
 * been pinged lately, sits between the sub-navigation and the page, so that it
 * reaches every admin page. The frame stays mounted while the administrator moves
 * between the pages, so the notice reads the heartbeat once for the whole visit.
 */
export default function AdminFrame() {
  return (
    <Page title="Administración" className="admin-frame">
      <nav className="admin-frame__nav" aria-label="Secciones de administración">
        <ul className="admin-frame__links">
          {ADMIN_PAGES.map(({ to, label }) => (
            <li key={to}>
              <NavLink className={linkClass} to={to}>{label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <KeepaliveBanner />
      <Outlet />
    </Page>
  );
}
