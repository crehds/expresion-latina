import PropTypes from 'prop-types';

import { todayInLima } from '../../../shared/limaCalendar';
import { coveredThrough } from '../../membership/domain/rules';
import { useAttendance } from '../composition/AttendanceProvider';
import { nextOccurrence, occurrenceKey } from '../domain/occurrences';
import { controlState } from '../domain/rules';
import AttendanceControl from './AttendanceControl';

// A cast rehearsal occupies the schedule but is not a class a member attends.
const REHEARSAL = 'rehearsal';

/**
 * The attendance control of one class on the public schedule (Spec: Confirm
 * Attendance, Cancel Attendance, Inactive Member Schedule View).
 *
 * Container: it works out the next occurrence of the class, asks the domain what
 * the signed-in member may do with it, and hands the answer and the actions to the
 * presentational control. It renders nothing for a visitor, a signed-out member, a
 * disabled backend, data that is still loading, a rehearsal, or a class whose
 * occurrence cannot be worked out, so the card stays what it is without a
 * membership. The buttons call the provider with this card's occurrence and never
 * receive the click event.
 *
 * An administrator has free access to classes, so their card never says that the
 * membership is not active (the provider tells whether the viewer is one).
 *
 * A failure is shown only on the card whose occurrence it belongs to.
 */
function SessionAttendance({ session, whatsappLink = null }) {
  const {
    membership, isAdmin, confirmedKeys, now, busyKey, errorCode, errorKey, confirm, cancel,
  } = useAttendance();

  if (!membership || session.genre.kind === REHEARSAL) {
    return null;
  }

  let occurrence;
  try {
    occurrence = nextOccurrence(session, now);
  } catch {
    // A room that makes no usable key: the class has no identity to confirm.
    return null;
  }

  const key = occurrenceKey(occurrence);
  const state = controlState({
    occurrence, now, membership, confirmedKeys, isAdmin,
  });

  return (
    <AttendanceControl
      state={state}
      classDate={occurrence.classDate}
      coveredThrough={coveredThrough(membership.periods, todayInLima(now))}
      whatsappLink={whatsappLink}
      busy={busyKey === key}
      errorCode={errorKey === key ? errorCode : null}
      onConfirm={() => confirm(occurrence)}
      onCancel={() => cancel(occurrence)}
    />
  );
}

SessionAttendance.propTypes = {
  session: PropTypes.shape({
    genre: PropTypes.shape({ kind: PropTypes.string }).isRequired,
  }).isRequired,
  whatsappLink: PropTypes.string,
};

export default SessionAttendance;
