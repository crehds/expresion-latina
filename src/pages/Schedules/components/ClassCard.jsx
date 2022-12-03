import PropTypes from 'prop-types';

import '../css/class-card.css';

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ClassCard(props) {
  const { danceGenre, currentDay, day } = props;
  return (
    <div className={`class-card${days[currentDay] === day ? ' class-card--active' : ''}`}>
      <p className="text-sm">{danceGenre?.name}</p>
    </div>
  );
}

ClassCard.propTypes = {
  day: PropTypes.string,
  currentDay: PropTypes.number.isRequired,
  danceGenre: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
  }),
};

ClassCard.defaultProps = {
  day: '',
  danceGenre: {
    name: 'Sin asignar',
  },
};

export default ClassCard;
