import PropTypes from 'prop-types';
import '../css/day.css';
import Template from './Template';

export default function Day(props) {
  const { hours } = props;
  const classContainer = 'day';
  const classChild = 'day-hour';
  return (
    <Template
      content={hours}
      classContainer={classContainer}
      classChild={classChild}
      keyword="range"
    />
  );
}

Day.propTypes = {
  hours: PropTypes.instanceOf(Object).isRequired,
};
