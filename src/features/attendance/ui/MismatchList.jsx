/**
 * The confirmations whose class is no longer in the schedule (Spec: Schedule
 * Changes), for the administrator.
 *
 * A class that was moved, renamed or dropped leaves the confirmations made for it
 * behind, and the member cannot see them any more. Each row shows what the member
 * confirmed, from the snapshot stored with the confirmation (the class name, the
 * date, the times and the room), and the name of the member, so the administrator
 * can reach them. It renders nothing when no confirmation stopped matching.
 */
import PropTypes from 'prop-types';
import { useId } from 'react';

import { MISMATCH_TITLE, UNNAMED_MEMBER, occurrenceLine } from './attendanceCopy';

import './css/mismatch-list.css';

export default function MismatchList({ rows }) {
  const titleId = useId();

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="mismatch-list" aria-labelledby={titleId}>
      <h3 className="heading-sm mismatch-list__title" id={titleId}>{MISMATCH_TITLE}</h3>
      <ul className="mismatch-list__items">
        {rows.map((row) => (
          <li
            className="mismatch-list__item"
            key={`${row.memberId}|${row.classDate}|${row.startTime}|${row.genreId}|${row.roomKey}`}
          >
            <span className="mismatch-list__name">{row.fullName ?? UNNAMED_MEMBER}</span>
            <span className="mismatch-list__class">{row.genreName}</span>
            <span className="mismatch-list__when">{occurrenceLine(row)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

MismatchList.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    memberId: PropTypes.string.isRequired,
    fullName: PropTypes.string,
    classDate: PropTypes.string.isRequired,
    startTime: PropTypes.string.isRequired,
    endTime: PropTypes.string.isRequired,
    genreId: PropTypes.string.isRequired,
    roomKey: PropTypes.string.isRequired,
    genreName: PropTypes.string.isRequired,
    roomLabel: PropTypes.string.isRequired,
  })).isRequired,
};
