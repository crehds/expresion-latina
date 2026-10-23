import PropTypes from 'prop-types';

import SessionCard from './SessionCard';

import '../css/day-agenda.css';

/**
 * One day's classes, earliest first. A day with none says so: the academy
 * being closed is ordinary information, not a gap to hide.
 *
 * `renderSessionAction(session)`, when given, returns what goes under each class.
 * `teacherLink(teacher)`, when given, says where each teacher's name links to (see
 * SessionCard).
 */
function DayAgenda({
  day, sessions, renderSessionAction = undefined, teacherLink = undefined,
}) {
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
              <SessionCard
                session={session}
                action={renderSessionAction?.(session)}
                teacherLink={teacherLink}
              />
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
  renderSessionAction: PropTypes.func,
  teacherLink: PropTypes.func,
};

export default DayAgenda;
