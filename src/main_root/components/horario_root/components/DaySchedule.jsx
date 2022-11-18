import PropTypes from 'prop-types';
import Template from './Template';
import '../css/dayschedule.css';

export default function DaySchedule(props) {
  const { generos, daysLength, actualDay } = props;
  const itemsSchedule = [];

  for (let index = 0; index < daysLength; index += 1) {
    if (actualDay === index - 6) {
      itemsSchedule.push(
        <Template
          content={generos}
          classContainer="day-schedule grid-active"
          classChild="day-schedule-item"
          keyword="name"
          key={index}
        />,
      );
    } else if (actualDay === index + 1) {
      itemsSchedule.push(
        <Template
          content={generos}
          classContainer="day-schedule grid-active"
          classChild="day-schedule-item"
          keyword="name"
          key={index}
        />,
      );
    } else {
      itemsSchedule.push(
        <Template
          content={generos}
          classContainer="day-schedule"
          classChild="day-schedule-item"
          keyword="name"
          key={index}
        />,
      );
    }
  }

  return <div className="days-schedule">{itemsSchedule}</div>;
}

DaySchedule.propTypes = {
  generos: PropTypes.instanceOf(Object).isRequired,
  daysLength: PropTypes.number.isRequired,
  actualDay: PropTypes.instanceOf(Date).isRequired,

};
