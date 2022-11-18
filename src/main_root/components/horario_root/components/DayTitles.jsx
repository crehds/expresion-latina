import PropTypes from 'prop-types';
import '../css/daytitles.css';
import Template from './Template';

export default function DayTitles(props) {
  const { actualDay, days } = props;
  const classContainer = 'day-titles';
  const classChild = 'day-title';
  return (
    <Template
      days={days}
      classContainer={classContainer}
      classChild={classChild}
      keyword="abbreviation"
      gridActive={actualDay}
    />
  );
}

DayTitles.propTypes = {
  actualDay: PropTypes.instanceOf(Date).isRequired,
  days: PropTypes.instanceOf(Array).isRequired,
};
