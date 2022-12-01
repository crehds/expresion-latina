import PropTypes from 'prop-types';
import DAYS from '../api/days';

import '../css/days.css';

function Days(props) {
  const { currentDay } = props;
  console.log(currentDay);
  return (
    DAYS.map((day) => (
      <div key={day.id} className="day">
        <p className="heading-xs day__name">{day.name}</p>
      </div>
    ))
  );
}

Days.propTypes = {
  currentDay: PropTypes.number.isRequired,
};

export default Days;
