import PropTypes from 'prop-types';
import { useId } from 'react';

import { CheckIcon, CrossIcon } from './AttendanceIcons';
import {
  CANCEL_ATTENDANCE,
  CONFIRMED,
  CONFIRM_ATTENDANCE,
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
 * - `confirm`: a light round toggle that is not pressed, an outline with a CHECK
 *   (the action is to confirm), and the date of the class it is for;
 * - `inactive`: the very same toggle, for a member with no active membership. What a
 *   tap does is the container's business (it asks the member to enrol and calls no
 *   server), and the control cannot tell the difference;
 * - `cancel`: the same toggle pressed, filled with an X (the action is to cancel), the
 *   caption "Vas a esta clase" with a small check, and the date;
 * - `uncovered`: the membership runs out before this class, with the last day it
 *   covers and the link to WhatsApp, when there is one;
 * - anything else (`hidden`, `started`): nothing. A membership that is not active
 *   today is said once, above the schedule (InactiveMembershipNotice), and a card
 *   does not repeat it.
 *
 * The toggle has no text. Its accessible name is the action it performs, so it
 * changes with the state ("Confirmar asistencia", "Cancelar asistencia"), and
 * `aria-pressed` says whether the member has confirmed. While an action is in
 * flight it is busy and disabled.
 *
 * An error is announced under any of them, and alone under `started`: the data may
 * have just changed under the member, so a refusal can sit on a card the page has
 * already moved to, and it still tells which class failed.
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
  if (state === 'confirm' || state === 'inactive' || state === 'cancel') {
    const confirming = state !== 'cancel';
    body = (
      <div className="attendance-control__row">
        <div className="attendance-control__text">
          {!confirming && (
            <p className="text-sm attendance-control__message">
              <CheckIcon className="attendance-icon--inline" />
              {CONFIRMED}
            </p>
          )}
          {date && <p id={dateId} className="text-sm attendance-control__date">{date}</p>}
        </div>
        <button
          type="button"
          className="attendance-control__toggle"
          aria-label={confirming ? CONFIRM_ATTENDANCE : CANCEL_ATTENDANCE}
          aria-pressed={!confirming}
          aria-describedby={date ? dateId : undefined}
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={confirming ? onConfirm : onCancel}
        >
          {confirming ? <CheckIcon /> : <CrossIcon />}
        </button>
      </div>
    );
  } else if (state === 'uncovered') {
    body = (
      <>
        <p className="text-sm attendance-control__message">{expiresText(coveredThrough)}</p>
        <WhatsappLink href={whatsappLink} />
      </>
    );
  }

  // A class that has started has no control, and the member still gets told why. No
  // other state without a body speaks.
  if (body === null && !(state === 'started' && errorCode)) {
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
