import { PureComponent } from 'react';
import PropTypes from 'prop-types';

import withRouter from '../../../../../hocs/withRouter';
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

class Options extends PureComponent {
  render() {
    const { location, onNavigate } = this.props;
    return (
      <ul className="options">
        {
          OPTIONS.map((option) => (
            <Option
              key={option.id}
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
};

export default withRouter(Options);
