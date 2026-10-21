/**
 * The people who confirmed each upcoming class (Spec: Admin-Only Attendee
 * Visibility), for the administrator.
 *
 * It takes the classes already grouped, in the order to show them, each with its
 * confirmations. A class is titled from the snapshot stored with its
 * confirmations (the class name, the date, the times and the room as they were
 * when each member confirmed), never from the current schedule, so it stays true
 * for a class that has since been moved. Under the title go the count and the
 * names, sorted; a name is all that is shown of a member. The member id is only a
 * React key and never reaches the screen.
 */
import PropTypes from 'prop-types';
import { useId } from 'react';

import {
  UNNAMED_MEMBER, attendeeCount, occurrenceLine,
} from './attendanceCopy';

import './css/attendee-list.css';

const byName = (a, b) => a.name.localeCompare(b.name, 'es');

function Occurrence({ rows }) {
  const titleId = useId();
  const [first] = rows;
  const attendees = rows
    .map((row) => ({ key: row.memberId, name: row.fullName ?? UNNAMED_MEMBER }))
    .sort(byName);

  return (
    <li className="attendee-list__occurrence">
      <h3 className="heading-sm attendee-list__title" id={titleId}>{first.genreName}</h3>
      <p className="text-md attendee-list__when">{occurrenceLine(first)}</p>
      <p className="text-md attendee-list__count">{attendeeCount(rows.length)}</p>
      <ul className="attendee-list__names" aria-labelledby={titleId}>
        {attendees.map(({ key, name }) => (
          <li className="text-md attendee-list__name" key={key}>{name}</li>
        ))}
      </ul>
    </li>
  );
}

const rowShape = PropTypes.shape({
  memberId: PropTypes.string.isRequired,
  fullName: PropTypes.string,
  classDate: PropTypes.string.isRequired,
  startTime: PropTypes.string.isRequired,
  endTime: PropTypes.string.isRequired,
  genreName: PropTypes.string.isRequired,
  roomLabel: PropTypes.string.isRequired,
});

Occurrence.propTypes = { rows: PropTypes.arrayOf(rowShape).isRequired };

export default function AttendeeList({ groups }) {
  return (
    <ul className="attendee-list">
      {groups.map(({ key, rows }) => <Occurrence key={key} rows={rows} />)}
    </ul>
  );
}

AttendeeList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    rows: PropTypes.arrayOf(rowShape).isRequired,
  })).isRequired,
};
