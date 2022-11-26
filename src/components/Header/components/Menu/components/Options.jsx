import { PureComponent } from 'react';
import '../css/options.css';
import Option from './Option';

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
  name: 'Reseñas',
  path: '/reviews',
},
{
  id: 6,
  name: 'Encuéntranos',
  path: '/contact',
},
];

function handleOption(event) {
  // event.preventDefault();
  const optionLink = event.target;
  if (optionLink.classList.contains('option__link--active')) return;
  const activeOptionLink = document.querySelector('.option__link--active');
  activeOptionLink.classList.remove('option__link--active');
  optionLink.classList.add('option__link--active');
}

export default class Options extends PureComponent {
  componentDidMount() {
    const optionsLink = document.querySelectorAll('.option__link');
    const firstOptionLink = optionsLink[0];
    firstOptionLink.classList.add('option__link--active');
  }

  render() {
    return (
      <ul className="options">
        {
          OPTIONS.map((option) => (
            <Option
              key={option.id}
              name={option.name}
              handleOption={handleOption}
              path={option.path}
            />
          ))
        }
      </ul>
    );
  }
}
