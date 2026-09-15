import PropTypes from 'prop-types';

import DayAgenda from './DayAgenda';

import '../css/week-columns.css';

/**
 * The whole week side by side, one column per day that holds classes.
 *
 * Columns are independent lists, not rows of a grid. The academy runs sixty
 * and ninety minute classes from the same start time, and one lone morning
 * class, so shared hour rows would mean two rows both labelled 19:00 and a
 * morning row empty on four days out of five.
 */
function WeekColumns(props) {
  const { days, sessionsByWeekday, currentWeekday } = props;

  return (
    <div className="week-columns" style={{ '--week-column-count': days.length }}>
      {days.map((day) => {
        const isToday = day.weekday === currentWeekday;
        return (
          <div
            key={day.id}
            className={`week-columns__day${isToday ? ' week-columns__day--today' : ''}`}
          >
            <h2 className="heading-xs week-columns__heading">
              {day.name}
              {isToday && <span className="sr-only"> (hoy)</span>}
            </h2>
            <DayAgenda day={day} sessions={sessionsByWeekday(day.weekday)} />
          </div>
        );
      })}
    </div>
  );
}

WeekColumns.propTypes = {
  days: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    weekday: PropTypes.number.isRequired,
  })).isRequired,
  sessionsByWeekday: PropTypes.func.isRequired,
  currentWeekday: PropTypes.number.isRequired,
};

export default WeekColumns;
