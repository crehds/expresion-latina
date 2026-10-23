import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import '../css/session-card.css';

/**
 * One class. Used both in the day agenda and in the week columns, so it
 * carries no layout of its own beyond its internal stacking.
 *
 * The teacher's name links to their profile. That was the point of the whole
 * data model: a session already knows who teaches it, so reading the schedule
 * and finding out who that person is should not be two separate journeys.
 *
 * The time is the first line and is set apart from the lines of detail below it (a
 * step larger, heavier and in the primary colour; the stylesheet does the last two),
 * because it is what a visitor scans the schedule for.
 *
 * `action` is whatever a page wants under the class (the attendance controls of a
 * signed-in member). It is rendered as the last child of the card, with no wrapper
 * of its own, so a card without one is the same markup as before.
 *
 * `teacherLink(teacher)`, when given, says where the teacher's name goes instead of
 * the teachers page: it returns the `to` and, optionally, the router `state` of the
 * link. The schedule uses it to open the profile over itself. Without it the link is
 * the one it always was, which is what the Home strip relies on.
 */
function SessionCard({ session, action = undefined, teacherLink = undefined }) {
  const {
    genre, slot, teacher, level, note,
  } = session;
  const link = teacher && (teacherLink?.(teacher) ?? { to: `/teachers/${teacher.id}` });

  return (
    <article className="session-card">
      <p className="text-md session-card__time">
        <time dateTime={slot.start}>{slot.start}</time>
        {' – '}
        <time dateTime={slot.end}>{slot.end}</time>
      </p>

      <h3 className="heading-xs session-card__genre">{genre.name}</h3>

      {(teacher || level) && (
        <p className="text-sm session-card__detail">
          {teacher && (
            <Link className="session-card__teacher" to={link.to} state={link.state}>
              {teacher.name}
            </Link>
          )}
          {teacher && level ? ' · ' : ''}
          {level}
        </p>
      )}

      {note && <p className="text-sm session-card__note">{note}</p>}

      {action}
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
    teacher: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
    }),
    level: PropTypes.string,
    note: PropTypes.string,
  }).isRequired,
  action: PropTypes.node,
  teacherLink: PropTypes.func,
};

export default SessionCard;
