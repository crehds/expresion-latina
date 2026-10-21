/**
 * Who confirmed each upcoming class (Spec: Admin-Only Attendee Visibility) and
 * which confirmations no longer match the schedule (Spec: Schedule Changes), a
 * section of the admin frame: the frame brings the heading of the area and the
 * landmark, so this one adds only its own level 2 heading.
 *
 * It reads the confirmations of the week ahead, from today in Lima to seven days
 * on, as soon as it opens, and again on "Reintentar". A failed read shows one fixed
 * alert and nothing the backend said. The answer is then compared with the classes
 * the current schedule produces for the same days: the confirmations that match are
 * listed under their class, and those that do not go under their own title.
 *
 * The comparison fails for the whole list on one malformed confirmation, on
 * purpose. Then the page says it could not compare, and still lists who confirmed
 * what, grouped by the stored occurrence, without a mismatch section: the
 * administrator keeps the attendee list even when the check cannot run. Without
 * an attendance adapter (the backend is off) it renders nothing.
 */
import {
  useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from 'react';

import { getSessionsForWeekday } from '../../data/selectors';
import { occurrenceKey } from '../../features/attendance/domain/occurrences';
import { expectedOccurrenceKeys, flagScheduleMismatch } from '../../features/attendance/domain/scheduleMatch';
import AttendeeList from '../../features/attendance/ui/AttendeeList';
import {
  ADMIN_ATTENDANCE_TITLE,
  ADMIN_READ_ERROR,
  LOADING_ATTENDEES,
  NO_ATTENDEES,
  RETRY,
  SCHEDULE_COMPARE_ERROR,
} from '../../features/attendance/ui/attendanceCopy';
import MismatchList from '../../features/attendance/ui/MismatchList';
import BackendContext from '../../shared/backend/BackendContext';
import { addDays, todayInLima } from '../../shared/limaCalendar';

import './css/admin-attendance.css';

// How far ahead the list looks: the days a member can confirm a class for.
const WINDOW_DAYS = 7;

const LOADING = { phase: 'loading' };

// The classes in the order their first confirmation came in. `occurrenceKey`
// never validates, so this works for a list the comparison refused.
function groupByOccurrence(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = occurrenceKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups].map(([key, groupRows]) => ({ key, rows: groupRows }));
}

// What the page shows for a list it read: the classes with their confirmations and
// the confirmations that stopped matching, or the best effort when it cannot tell.
function compareWithSchedule(rows, { fromDate, toDate }) {
  try {
    const expected = expectedOccurrenceKeys(getSessionsForWeekday, fromDate, toDate);
    const { byOccurrence, mismatched } = flagScheduleMismatch(rows, expected);
    const groups = [...byOccurrence].map(([key, groupRows]) => ({ key, rows: groupRows }));
    return { degraded: false, groups, mismatched };
  } catch {
    return { degraded: true, groups: groupByOccurrence(rows), mismatched: [] };
  }
}

export default function AdminAttendance() {
  const { services } = useContext(BackendContext);
  const attendance = services?.attendance ?? null;
  const titleId = useId();
  const [state, setState] = useState(LOADING);
  // Counts the reads, so that only the latest one may write its answer, and an
  // unmounted page writes none.
  const latestRef = useRef(0);

  const load = useCallback(async () => {
    latestRef.current += 1;
    const mine = latestRef.current;
    setState(LOADING);

    const fromDate = todayInLima(new Date());
    const window = { fromDate, toDate: addDays(fromDate, WINDOW_DAYS) };
    let result;
    try {
      result = await attendance.listUpcomingConfirmations(window);
    } catch {
      // The adapter never rejects; if it does, the screen must not wait for ever.
      result = { ok: false };
    }
    if (latestRef.current !== mine) {
      return;
    }
    setState(result.ok ? { phase: 'done', rows: result.data, window } : { phase: 'failed' });
  }, [attendance]);

  useEffect(() => {
    if (attendance) {
      load();
    }
    return () => {
      latestRef.current += 1;
    };
  }, [attendance, load]);

  const view = useMemo(
    () => (state.phase === 'done' ? compareWithSchedule(state.rows, state.window) : null),
    [state],
  );

  if (!attendance) {
    return null;
  }

  return (
    <section className="admin-attendance" aria-labelledby={titleId}>
      <h2 className="heading-sm admin-attendance__title" id={titleId}>{ADMIN_ATTENDANCE_TITLE}</h2>
      {state.phase === 'loading' && (
        <p className="text-md admin-attendance__status" role="status">{LOADING_ATTENDEES}</p>
      )}
      {state.phase === 'failed' && (
        <div className="admin-attendance__failure">
          <p className="text-md admin-attendance__alert" role="alert">{ADMIN_READ_ERROR}</p>
          <button type="button" className="text-sm admin-attendance__retry" onClick={load}>
            {RETRY}
          </button>
        </div>
      )}
      {view?.degraded && (
        <p className="text-md admin-attendance__alert" role="alert">{SCHEDULE_COMPARE_ERROR}</p>
      )}
      {view && state.rows.length === 0 && (
        <p className="text-md admin-attendance__status">{NO_ATTENDEES}</p>
      )}
      {view && view.groups.length > 0 && <AttendeeList groups={view.groups} />}
      {view && <MismatchList rows={view.mismatched} />}
    </section>
  );
}
