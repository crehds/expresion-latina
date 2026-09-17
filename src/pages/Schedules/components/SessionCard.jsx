import PropTypes from 'prop-types';

import '../css/session-card.css';

/**
 * One class. Used both in the day agenda and in the week columns, so it
 * carries no layout of its own beyond its internal stacking.
 */
function SessionCard(props) {
  const { session } = props;
  const {
    genre, slot, teacher, level, note,
  } = session;

  return (
    <article className="session-card">
      <p className="text-sm session-card__time">
        <time dateTime={slot.start}>{slot.start}</time>
        {' – '}
        <time dateTime={slot.end}>{slot.end}</time>
      </p>

      <h3 className="heading-xs session-card__genre">{genre.name}</h3>

      {(teacher || level) && (
        <p className="text-sm session-card__detail">
          {teacher?.name}
          {teacher && level ? ' · ' : ''}
          {level}
        </p>
      )}

      {note && <p className="text-sm session-card__note">{note}</p>}
    </article>
  );
}

SessionCard.propTypes = {
  session: PropTypes.shape({
    genre: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
    slot: PropTypes.shape({
      start: PropTypes.string.isRequired,
      end: PropTypes.string.isRequired,
    }).isRequired,
    teacher: PropTypes.shape({ name: PropTypes.string }),
    level: PropTypes.string,
    note: PropTypes.string,
  }).isRequired,
};

export default SessionCard;
