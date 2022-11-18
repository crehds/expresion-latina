import '../css/template.css';
import PropTypes from 'prop-types';

export default function Template(props) {
  const {
    classContainer, days, gridActive, classChild, keyword,
  } = props;
  return (
    <div className={classContainer}>
      {days.map((day, index) => {
        if (gridActive === index - 6) {
          return (
            <div className={`${classChild} grid-active`} key={day.id}>
              {day[keyword]}
            </div>
          );
        }
        if (gridActive === index + 1) {
          return (
            <div className={`${classChild} grid-active`} key={day.id}>
              {day[keyword]}
            </div>
          );
        }
        return (
          <div className={classChild} key={day.id}>
            {day[keyword]}
          </div>
        );
      })}
    </div>
  );
}

Template.propTypes = {
  classChild: PropTypes.string.isRequired,
  classContainer: PropTypes.string.isRequired,
  gridActive: PropTypes.instanceOf(Date).isRequired,
  days: PropTypes.instanceOf(Array).isRequired,
  keyword: PropTypes.string.isRequired,
};
