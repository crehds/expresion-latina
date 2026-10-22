import { useAttendance } from '../composition/AttendanceProvider';
import { CheckIcon, CrossIcon } from './AttendanceIcons';
import {
  LEGEND_CANCEL_WORDS,
  LEGEND_CHECK_NAME,
  LEGEND_CONFIRM_WORDS,
  LEGEND_CROSS_NAME,
  LEGEND_TOUCH,
} from './attendanceCopy';

import './css/attendance-legend.css';

/**
 * The legend above the public schedule that explains the two icons of the attendance
 * controls: "Toca (check) para confirmar tu asistencia y (X) para cancelarla."
 * (a draft of the copy for the owner's review). The icons are drawn as real
 * elements, small copies of the two toggles (an outline with the check, a filled
 * circle with the X), each with a name for a screen reader, so the sentence reads
 * the same aloud.
 *
 * It shows only where the controls show: a signed-in member or an administrator
 * whose data was read. For a visitor, a session that is loading, a disabled backend,
 * and data that is not there yet or could not be read, it renders nothing, so the
 * page stays what it was. It does not matter whether the membership is active: a
 * member without one sees the same checks.
 */
function AttendanceLegend() {
  const { membership } = useAttendance();

  if (!membership) {
    return null;
  }

  return (
    <p className="text-sm attendance-legend">
      {`${LEGEND_TOUCH} `}
      <span
        className="attendance-legend__badge attendance-legend__badge--check"
        role="img"
        aria-label={LEGEND_CHECK_NAME}
      >
        <CheckIcon />
      </span>
      {` ${LEGEND_CONFIRM_WORDS} `}
      <span
        className="attendance-legend__badge attendance-legend__badge--cross"
        role="img"
        aria-label={LEGEND_CROSS_NAME}
      >
        <CrossIcon />
      </span>
      {` ${LEGEND_CANCEL_WORDS}`}
    </p>
  );
}

export default AttendanceLegend;
