/**
 * Keeps an admin page for the administrator (Design: D10; Spec: Payment
 * Privilege Restriction).
 *
 * It goes inside `BackendRoute`, which answers for the kill switch, and it
 * starts the session on mount like the account page does: a visitor with no
 * stored session must not be left waiting for something that never starts.
 *
 * - While the session loads it shows a loading status.
 * - A visitor, or an error with no session behind it, goes to the login page.
 * - An error with a session left shows an alert and a way to try again.
 * - An administrator gets the page.
 * - Anyone else gets the not-found page, the one an address that does not exist
 *   gets, and the page is never mounted: whatever it would ask the backend for
 *   on mount is never asked. That covers a member who is not an administrator, a
 *   profile that did not load and a backend that is off, because the page is
 *   shown only when the profile says so.
 *
 * What the profile says is a convenience. The database stays the authority: it
 * refuses the directory and the payments to anyone who is not an administrator,
 * so a stale flag at most ends in a refused request.
 */
import PropTypes from 'prop-types';
import { lazy, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

import Page from '../components/Page/Page';
import { useSession } from '../features/accounts/composition/SessionProvider';
import startSession from '../features/accounts/ui/startSession';

import './css/admin-route.css';

const NotFound = lazy(() => import('../pages/NotFound/NotFound'));

// Neutral on purpose: until the profile says so, nothing here tells the reader
// that an administration area exists.
const TITLE = 'Comprobando tu acceso';
const LOADING = 'Cargando…';
const LOAD_FAILED = 'No pudimos comprobar tu acceso. Inténtalo de nuevo.';
const RETRY = 'Reintentar';

export default function AdminRoute({ children }) {
  const session = useSession();
  const { status, profile, start } = session;

  useEffect(() => {
    startSession({ start });
  }, [start]);

  if (status === 'signed-out' || (status === 'error' && !session.session)) {
    return <Navigate to="/login" replace />;
  }

  if (status === 'error') {
    return (
      <Page title={TITLE} className="admin-route">
        <p className="text-md admin-route__message" role="alert">{LOAD_FAILED}</p>
        <button
          type="button"
          className="admin-route__button"
          onClick={() => startSession({ start })}
        >
          {RETRY}
        </button>
      </Page>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <Page title={TITLE} className="admin-route">
        <p className="text-md admin-route__message" role="status">{LOADING}</p>
      </Page>
    );
  }

  return status === 'signed-in' && profile?.isAdmin === true ? children : <NotFound />;
}

AdminRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
