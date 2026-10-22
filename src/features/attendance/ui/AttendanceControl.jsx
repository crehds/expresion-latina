import PropTypes from 'prop-types';
import { useId } from 'react';

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

// The check of a class the member goes to. The icon font has no check, so it is
// drawn inline; only its geometry is here, and the stylesheet gives it its colour
// and its size, because the CSP allows no style attribute. It is decorative: the
// toggle has its own name.
function CheckIcon() {
  return (
    <svg
      className="attendance-control__icon attendance-control__check"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}

/**
 * What a signed-in member sees under one class of the public schedule
 * (Spec: Confirm Attendance, Cancel Attendance, Inactive Member Schedule View).
 * Presentational: the container decides the state and runs the actions.
 *
 * - `confirm`: a light round toggle that is not pressed, an outline with a calendar
 *   icon, and the date of the class it is for;
 * - `cancel`: the same toggle pressed, filled with a check, the caption that the
 *   member goes to the class and the date;
 * - `uncovered`: the membership runs out before this class, with the last day it
 *   covers and the link to WhatsApp, when there is one;
 * - anything else (`inactive`, `hidden`, `started`): nothing. A membership that is
 *   not active today is said once, above the schedule (InactiveMembershipNotice),
 *   and no longer on every card.
 *
 * The toggle has no text. Its accessible name is the action it performs, so it
 * changes with the state ("Confirmar asistencia", "Cancelar asistencia"), and
 * `aria-pressed` says whether the member has confirmed. While an action is in
 * flight it is busy and disabled.
 *
 * An error is announced under any of them, and alone under `inactive` and
 * `started`: the data may have just changed under the member, so a refusal can sit
 * on a card the page has already moved to, and it still tells which class failed.
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
      <div className="attendance-control__row">
        <div className="attendance-control__text">
          {!confirming && <p className="text-sm attendance-control__message">{CONFIRMED}</p>}
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
          {confirming
            ? <span className="icon-calendar attendance-control__icon" aria-hidden="true" />
            : <CheckIcon />}
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

  // A class that has started has no control, and the member still gets told why;
  // the same goes for a card that turned inactive under a refused confirm. No other
  // state without a body speaks.
  const speaksAlone = state === 'started' || state === 'inactive';
  if (body === null && !(speaksAlone && errorCode)) {
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
