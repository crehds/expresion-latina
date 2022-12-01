import PropTypes from 'prop-types';

import '../css/class-card.css';

function ClassCard(props) {
  const { danceGenre } = props;
  return (
    <div className="class-card">
      <p className="text-sm">{danceGenre?.name}</p>
    </div>
  );
}

ClassCard.propTypes = {
  danceGenre: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
};
export default ClassCard;
