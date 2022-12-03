import PropTypes from 'prop-types';
import DAYS from '../api/days';

import '../css/days.css';

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function Days(props) {
  const { currentDay } = props;
  return (
    DAYS.map((day) => (
      <div key={day.id} className={`day${days[currentDay] === day.name ? ' day--active' : ''}`}>
        <p className="heading-xs day__name">{day.name}</p>
      </div>
    ))
  );
}

Days.propTypes = {
  currentDay: PropTypes.number.isRequired,
};

export default Days;
