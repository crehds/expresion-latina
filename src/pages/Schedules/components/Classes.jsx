import PropTypes from 'prop-types';

import '../css/classes.css';
import ClassCard from './ClassCard';
import Days from './Days';

function Classes(props) {
  const { classes, currentDay } = props;

  return (
    <div className="classes">
      <Days currentDay={currentDay} />
      {classes.map((classesPerHour) => (
        classesPerHour.map((classData) => (
          <ClassCard
            key={`class-card-${classData.id}`}
            danceGenre={classData.danceGenre}
          />
        ))
      ))}
    </div>

  );
}

Classes.propTypes = {
  currentDay: PropTypes.instanceOf(Date).isRequired,
  classes: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([
          PropTypes.number.isRequired,
          PropTypes.string.isRequired,
        ]),
        hour: PropTypes.string,
        day: PropTypes.string,
        danceGenre: PropTypes.shape({
          id: PropTypes.number,
          name: PropTypes.string,
        }),
      }),
    ),
  ).isRequired,
};

export default Classes;
