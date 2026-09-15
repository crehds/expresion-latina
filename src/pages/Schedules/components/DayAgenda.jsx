import PropTypes from 'prop-types';

import SessionCard from './SessionCard';

import '../css/day-agenda.css';

/**
 * One day's classes, earliest first. A day with none says so: the academy
 * being closed is ordinary information, not a gap to hide.
 */
function DayAgenda(props) {
  const { day, sessions } = props;

  return (
    <section className="day-agenda" aria-label={day.name}>
      {sessions.length === 0 ? (
        <p className="text-sm day-agenda__empty">
          No hay clases los
          {' '}
          {day.name.toLowerCase()}
          .
        </p>
      ) : (
        <ol className="day-agenda__list">
          {sessions.map((session) => (
            <li key={session.id}>
              <SessionCard session={session} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

DayAgenda.propTypes = {
  day: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
  sessions: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired })).isRequired,
};

export default DayAgenda;
