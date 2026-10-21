/**
 * The signed-in member's attendance for the public schedule (Design: D4, D10).
 *
 * The provider is inert unless there is something to show: the backend is on, the
 * services are there and the session is `signed-in`. In every other case (a
 * visitor, a signed-out member, a session that is still loading, a disabled
 * backend) it makes no adapter call, starts no timer and hands out empty values,
 * so the schedule page stays what it is for a visitor. It never calls the
 * session's `start()` either: the public page must not load supabase-js for
 * someone who has no stored session.
 *
 * Once a member is signed in it reads their paid periods and their confirmations
 * once, and exposes:
 * - `ready`: both reads worked; until then `membership` is null, so no control
 *   shows (nothing flashes as "inactive" while the data loads);
 * - `membership`: `{ periods }`, or null; `confirmedKeys`: a Set of occurrence keys;
 * - `now`: a Date that ticks every 30 seconds, so a control does not outlive the
 *   start of its class on a tab left open;
 * - `busyKey`: the occurrence key of the action in flight, if any;
 * - `errorCode` and `errorKey`: the result code of the last failure and, for a
 *   failed action, the occurrence key it belongs to (null for a failed read);
 * - `confirm(occurrence)`, `cancel(occurrence)` and `retry()`.
 *
 * The database stays the authority. A cancel it refuses to carry out (STARTED) and
 * a confirm it refuses (FORBIDDEN) both mean this page was out of date, so they
 * read the data again. Any other failure keeps what is shown and says so.
 *
 * A read that outlives a sign-out, a change of user or an unmount is dropped: it
 * must never write state. Errors carry only a result code, never member data.
 */
import PropTypes from 'prop-types';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

import BackendContext from '../../../shared/backend/BackendContext';
import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';
import { todayInLima } from '../../../shared/limaCalendar';
import SessionContext from '../../accounts/composition/SessionProvider';
import { occurrenceKey } from '../domain/occurrences';

export const TICK_MS = 30 * 1000;

const NO_KEYS = new Set();

const INERT = Object.freeze({
  ready: false,
  membership: null,
  confirmedKeys: NO_KEYS,
  now: new Date(0),
  busyKey: null,
  errorCode: null,
  errorKey: null,
  confirm: async () => {},
  cancel: async () => {},
  retry: async () => {},
});

const AttendanceContext = createContext(INERT);

export const useAttendance = () => useContext(AttendanceContext);

export default function AttendanceProvider({ children }) {
  const { enabled, services } = useContext(BackendContext);
  const { status, session } = useContext(SessionContext);
  const attendance = enabled ? services?.attendance ?? null : null;
  const membership = enabled ? services?.membership ?? null : null;
  const userId = status === 'signed-in' ? session?.userId ?? null : null;
  const active = Boolean(attendance && membership && userId);

  const [data, setData] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [busyKey, setBusyKey] = useState(null);
  const [failure, setFailure] = useState({ code: null, key: null });

  // Retires work started for a user or a mount that is gone, and keeps a second
  // action from starting while one is in flight.
  const epochRef = useRef(0);
  const busyRef = useRef(false);

  // Both reads, for the Lima today on. Resolves to null for a read that went stale.
  const read = useCallback(async () => {
    const epoch = epochRef.current;
    const fromDate = todayInLima(new Date());
    let periods;
    let confirmations;
    try {
      [periods, confirmations] = await Promise.all([
        membership.listOwnPeriods({ userId, fromDate }),
        attendance.listOwnConfirmations({ userId, fromDate }),
      ]);
    } catch {
      // Adapters never reject; if one does, the read failed like any other.
      periods = fail(RESULT_CODES.UNKNOWN);
      confirmations = periods;
    }
    if (epochRef.current !== epoch) {
      return null;
    }
    if (!periods.ok || !confirmations.ok) {
      return { ok: false, code: periods.ok ? confirmations.code : periods.code };
    }
    return {
      ok: true,
      data: {
        periods: periods.data,
        confirmedKeys: new Set(confirmations.data.map(occurrenceKey)),
      },
    };
  }, [attendance, membership, userId]);

  const load = useCallback(async () => {
    const result = await read();
    if (!result) {
      return;
    }
    if (result.ok) {
      setData(result.data);
      setFailure({ code: null, key: null });
    } else {
      setFailure({ code: result.code, key: null });
    }
  }, [read]);

  // After a refusal: the data shown was out of date. A read that fails here leaves
  // what is shown, and the failure of the action stays the one reported.
  const settle = useCallback(async () => {
    const result = await read();
    if (result?.ok) {
      setData(result.data);
    }
  }, [read]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    load();
    return () => {
      // A new user, a sign-out or an unmount: forget the data and drop what is
      // still on its way.
      epochRef.current += 1;
      busyRef.current = false;
      setData(null);
      setBusyKey(null);
      setFailure({ code: null, key: null });
    };
  }, [active, load]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  const act = useCallback(async (occurrence, run, applyOk) => {
    if (busyRef.current || !active) {
      return;
    }
    const epoch = epochRef.current;
    const key = occurrenceKey(occurrence);
    busyRef.current = true;
    setBusyKey(key);
    setFailure({ code: null, key: null });

    let result;
    try {
      result = await run(occurrence);
    } catch {
      // Adapters never reject; if one does, the action failed and the provider
      // must not stay busy for ever.
      result = fail(RESULT_CODES.UNKNOWN);
    }
    if (epochRef.current !== epoch) {
      return;
    }
    busyRef.current = false;
    setBusyKey(null);

    if (result.ok) {
      setData((previous) => (previous
        ? { ...previous, confirmedKeys: applyOk(previous.confirmedKeys, key) }
        : previous));
      return;
    }
    setFailure({ code: result.code, key });
    if (result.code === RESULT_CODES.STARTED || result.code === RESULT_CODES.FORBIDDEN) {
      await settle();
    }
  }, [active, settle]);

  const confirm = useCallback((occurrence) => act(
    occurrence,
    (value) => attendance.confirm(value),
    (keys, key) => new Set(keys).add(key),
  ), [act, attendance]);

  const cancel = useCallback((occurrence) => act(
    occurrence,
    (value) => attendance.cancel(value),
    (keys, key) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    },
  ), [act, attendance]);

  const retry = useCallback(async () => {
    if (!active) {
      return;
    }
    setFailure({ code: null, key: null });
    await load();
  }, [active, load]);

  const value = useMemo(() => {
    if (!active) {
      return INERT;
    }
    return {
      ready: data !== null,
      membership: data ? { periods: data.periods } : null,
      confirmedKeys: data ? data.confirmedKeys : NO_KEYS,
      now,
      busyKey,
      errorCode: failure.code,
      errorKey: failure.key,
      confirm,
      cancel,
      retry,
    };
  }, [active, data, now, busyKey, failure, confirm, cancel, retry]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

AttendanceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
