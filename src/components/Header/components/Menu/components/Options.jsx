import { PureComponent } from 'react';
import PropTypes from 'prop-types';

import withRouter from '../../../../../hocs/withRouter';
import withSession from '../../../../../features/accounts/composition/withSession';
import Option from './Option';

import '../css/options.css';

const OPTIONS = [{
  id: 1,
  name: 'Inicio',
  path: '/',
},
{
  id: 2,
  name: 'Profesores',
  path: '/teachers',
},
{
  id: 3,
  name: 'Clases',
  path: '/dances',
},
{
  id: 4,
  name: 'Horario',
  path: '/schedules',
},
{
  id: 5,
  name: 'Encuéntranos',
  path: '/contact',
},
];

// The entries the session adds after the five public ones. While the backend is
// off (status "disabled") and while a session loads there are none: a visitor
// must not be offered a sign-in that is about to turn into an account link. A
// stored session starts as "loading", so "idle" only means that nothing is
// stored or loaded, and a visitor can sign in.
function sessionOptions({ status, profile }) {
  if (status === 'signed-in') {
    const account = { id: 'account', name: 'Mi cuenta', path: '/account' };
    // One entry for the whole admin area: it links to the members and stays lit
    // on every other admin page.
    return profile?.isAdmin
      ? [account, {
        id: 'admin', name: 'Admin', path: '/admin/members', activePath: '/admin',
      }]
      : [account];
  }
  if (status === 'idle' || status === 'signed-out' || status === 'error') {
    return [{ id: 'login', name: 'Ingresar', path: '/login' }];
  }
  return [];
}

class Options extends PureComponent {
  render() {
    const { location, onNavigate, session } = this.props;
    return (
      <ul className="options">
        {
          [...OPTIONS, ...sessionOptions(session)].map((option) => (
            <Option
              key={option.id}
              activePath={option.activePath}
              location={location}
              name={option.name}
              onNavigate={onNavigate}
              path={option.path}
            />
          ))
        }
      </ul>
    );
  }
}

Options.propTypes = {
  location: PropTypes.instanceOf(Object).isRequired,
  onNavigate: PropTypes.func.isRequired,
  session: PropTypes.shape({
    status: PropTypes.string.isRequired,
    profile: PropTypes.shape({ isAdmin: PropTypes.bool }),
  }).isRequired,
};

// The session is read outside the class (no hooks inside it); the router props
// reach it through withRouter.
export default withSession(withRouter(Options));
