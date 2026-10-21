import PropTypes from 'prop-types';
import { useId } from 'react';

import {
  CANCEL_ATTENDANCE,
  CONFIRMED,
  CONFIRM_ATTENDANCE,
  NOT_ACTIVE,
  WHATSAPP_LINK_TEXT,
  attendanceErrorMessage,
  classDateText,
  expiresText,
} from './attendanceCopy';

import './css/attendance-control.css';

function WhatsappLink({ href = null }) {
  return href && (
    <a className="text-sm attendance-control__link" href={href} target="_blank" rel="noreferrer">
      {WHATSAPP_LINK_TEXT}
    </a>
  );
}

WhatsappLink.propTypes = { href: PropTypes.string };

/**
 * What a signed-in member sees under one class of the public schedule
 * (Spec: Confirm Attendance, Cancel Attendance, Inactive Member Schedule View).
 * Presentational: the container decides the state and runs the actions.
 *
 * - `confirm`: the button to confirm, with the date of the class it is for;
 * - `cancel`: that the attendance is confirmed, and the button to cancel it;
 * - `inactive`: the membership is not active, with the WhatsApp link when there is
 *   one (the message alone otherwise);
 * - `uncovered`: the membership runs out before this class, with the last day it
 *   covers and the same link;
 * - anything else (`hidden`, `started`): nothing.
 *
 * An error is announced under any of them: the data may have just changed under
 * the member, so a refusal can sit next to a state the page has already moved to.
 */
function AttendanceControl({
  state = 'hidden',
  classDate = undefined,
  coveredThrough = null,
  whatsappLink = null,
  busy = false,
  errorCode = null,
  onConfirm,
  onCancel,
}) {
  const dateId = useId();
  const date = classDateText(classDate);

  let body = null;
  if (state === 'confirm' || state === 'cancel') {
    const confirming = state === 'confirm';
    body = (
      <>
        {!confirming && <p className="text-sm attendance-control__message">{CONFIRMED}</p>}
        {date && <p id={dateId} className="text-sm attendance-control__date">{date}</p>}
        <button
          type="button"
          className="text-sm attendance-control__button"
          aria-describedby={date ? dateId : undefined}
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={confirming ? onConfirm : onCancel}
        >
          {confirming ? CONFIRM_ATTENDANCE : CANCEL_ATTENDANCE}
        </button>
      </>
    );
  } else if (state === 'inactive' || state === 'uncovered') {
    body = (
      <>
        <p className="text-sm attendance-control__message">
          {state === 'inactive' ? NOT_ACTIVE : expiresText(coveredThrough)}
        </p>
        <WhatsappLink href={whatsappLink} />
      </>
    );
  }

  // An error needs no body to be worth saying: a class that has started has no
  // control, and the member still gets told why.
  if (body === null && !errorCode) {
    return null;
  }

  return (
    <div className="attendance-control">
      {body}
      {errorCode && (
        <p className="text-sm attendance-control__alert" role="alert">
          {attendanceErrorMessage(errorCode)}
        </p>
      )}
    </div>
  );
}

AttendanceControl.propTypes = {
  state: PropTypes.string,
  classDate: PropTypes.string,
  coveredThrough: PropTypes.string,
  whatsappLink: PropTypes.string,
  busy: PropTypes.bool,
  errorCode: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default AttendanceControl;
