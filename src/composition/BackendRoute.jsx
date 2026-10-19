/**
 * Gates a feature route behind the backend kill switch (Design: D10, D12).
 *
 * While the backend is off the route renders the not-found page, exactly as if
 * the address did not exist; while it is on, it renders the page. Each feature
 * slice wraps its own route element with it. It lives in the composition root
 * because `src/shared/**` may not import pages.
 */
import PropTypes from 'prop-types';
import { lazy, useContext } from 'react';
import BackendContext from '../shared/backend/BackendContext';

const NotFound = lazy(() => import('../pages/NotFound/NotFound'));

export default function BackendRoute({ children }) {
  const { enabled } = useContext(BackendContext);
  return enabled ? children : <NotFound />;
}

BackendRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
