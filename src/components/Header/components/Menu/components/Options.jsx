import { PureComponent } from 'react';
import '../css/options.css';

const OPTIONS = [{
  id: 1,
  name: 'Inicio',
},
{
  id: 2,
  name: 'Profesores',
},
{
  id: 3,
  name: 'Clases',
},
{
  id: 4,
  name: 'Horario',
},
{
  id: 5,
  name: 'Reseñas',
},
{
  id: 6,
  name: 'Encuéntranos',
},
];

export default class Options extends PureComponent {
  componentDidMount() {
    const options = document.querySelector('.options');
    const firstOption = options.firstElementChild;
    firstOption.classList.add('options__li--active');
  }

  render() {
    return (
      <ul className="options">
        {
          OPTIONS.map((option) => (
            <li key={option.id} className="options__li">
              <p>{option.name}</p>
            </li>
          ))
        }
      </ul>
    );
  }
}
