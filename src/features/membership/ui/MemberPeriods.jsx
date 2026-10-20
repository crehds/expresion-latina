/**
 * The payments of one member (Spec: Recording Paid Periods, Correcting Paid
 * Periods): the list, newest first as the adapter gives it, with a button to
 * record a payment and, for each one, buttons to correct it and to delete it.
 *
 * One thing is open at a time: the form to record a payment, the form to correct
 * one, or the question before a delete. Deleting asks first, like deleting an
 * account does: the first button opens a question, the second one deletes, and the
 * question can be cancelled.
 *
 * Nothing on the screen is guessed. The page owns the data, so after a change the
 * list is read again through `reload` (the member's own line comes with it) and
 * what is shown is what the database holds: after a change that worked, after
 * dates that overlap another payment (so the payment in the way shows up) and
 * after a payment that turned out to be gone. A form or a question stays busy
 * until that read has ended. Every failure shows the fixed message of its code.
 * The focus goes where the administrator is working: into a form or a question
 * when it opens, and back to the button that opened it when it closes.
 */
import PropTypes from 'prop-types';
import {
  useEffect, useId, useRef, useState,
} from 'react';

import { RESULT_CODES } from '../../../shared/backend/resultCodes';
import useMembership from '../composition/useMembership';
import {
  ADD_PERIOD,
  CANCEL,
  CONFIRM_DELETE_PERIOD,
  DELETE_PERIOD,
  DELETE_QUESTION,
  EDIT_PERIOD,
  NO_PERIODS,
  PERIODS_TITLE,
  PERIOD_GONE,
  deletePeriodErrorMessage,
  deletePeriodLabel,
  editPeriodLabel,
  periodRangeText,
} from './membershipCopy';
import PeriodForm from './PeriodForm';

import './css/member-periods.css';

// What is open, as `{ kind: 'create' }`, `{ kind: 'edit', id }` or
// `{ kind: 'delete', id }`; nothing open is null.
const openerKey = (mode) => (mode.kind === 'create' ? 'create' : `${mode.kind}:${mode.id}`);

// The question before a delete. It takes the focus when it opens, stays busy
// while the delete is on its way, and ignores a second press in the same instant.
function DeleteConfirm({ onConfirm, onCancel }) {
  const questionId = useId();
  const groupRef = useRef(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failureCode, setFailureCode] = useState(null);

  useEffect(() => {
    groupRef.current?.focus();
  }, []);

  const handleConfirm = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailureCode(null);
    try {
      const result = await onConfirm();
      if (!result.ok) {
        setFailureCode(result.code);
      }
    } catch {
      setFailureCode(RESULT_CODES.UNKNOWN);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div
      className="member-periods__confirm"
      role="group"
      aria-labelledby={questionId}
      tabIndex={-1}
      ref={groupRef}
    >
      <p className="text-md member-periods__question" id={questionId}>{DELETE_QUESTION}</p>
      {failureCode && (
        <p className="member-periods__alert" role="alert">{deletePeriodErrorMessage(failureCode)}</p>
      )}
      <div className="member-periods__actions">
        <button
          type="button"
          className="member-periods__button member-periods__button--primary"
          disabled={busy}
          onClick={handleConfirm}
        >
          {CONFIRM_DELETE_PERIOD}
        </button>
        <button type="button" className="member-periods__button" disabled={busy} onClick={onCancel}>
          {CANCEL}
        </button>
      </div>
    </div>
  );
}

DeleteConfirm.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default function MemberPeriods({ memberId, periods, reload }) {
  const membership = useMembership();
  const titleId = useId();
  const [mode, setMode] = useState(null);
  const [periodGone, setPeriodGone] = useState(false);
  // The buttons that open things, to give the focus back to, and the heading to
  // fall back on when the button is gone (the payment that was deleted).
  const openersRef = useRef(new Map());
  const headingRef = useRef(null);
  const previousModeRef = useRef(null);

  useEffect(() => {
    const previous = previousModeRef.current;
    previousModeRef.current = mode;
    if (previous && mode === null) {
      (openersRef.current.get(openerKey(previous)) ?? headingRef.current)?.focus();
    }
  }, [mode]);

  if (!membership) {
    return null;
  }

  const opener = (key) => (element) => {
    if (element) {
      openersRef.current.set(key, element);
    } else {
      openersRef.current.delete(key);
    }
  };

  const open = (next) => {
    setPeriodGone(false);
    setMode(next);
  };

  // Closes `target` only if it is still what is open: the administrator may have
  // opened something else while it was saving.
  const finish = (target) => setMode((current) => (current === target ? null : current));

  // The page shows its own failure if it cannot read the member again.
  const refresh = async () => {
    try {
      await reload();
    } catch {
      // Nothing more to do here.
    }
  };

  // Runs one change, and reads the member again when what the database holds may
  // differ from the screen: after it worked, after the dates overlapped another
  // payment, and after the payment turned out to be gone. The result goes back to
  // the form or the question, which show the message of a failure.
  const change = async (target, call) => {
    const result = await call();
    if (
      result.ok
      || result.code === RESULT_CODES.OVERLAP
      || result.code === RESULT_CODES.NOT_FOUND
    ) {
      await refresh();
    }
    if (result.ok) {
      finish(target);
    } else if (result.code === RESULT_CODES.NOT_FOUND) {
      setPeriodGone(true);
      finish(target);
    }
    return result;
  };

  const record = (target) => (values) => change(
    target,
    () => membership.createPeriod({ memberId, ...values }),
  );
  const correct = (target, id) => (values) => change(
    target,
    () => membership.updatePeriod(id, values),
  );
  const erase = (target, id) => () => change(target, () => membership.deletePeriod(id));

  const creating = mode?.kind === 'create';

  return (
    <section className="member-periods" aria-labelledby={titleId}>
      <div className="member-periods__header">
        <h3 className="heading-xs member-periods__title" id={titleId} tabIndex={-1} ref={headingRef}>
          {PERIODS_TITLE}
        </h3>
        {!creating && (
          <button
            type="button"
            className="member-periods__button member-periods__button--primary"
            ref={opener('create')}
            onClick={() => open({ kind: 'create' })}
          >
            {ADD_PERIOD}
          </button>
        )}
      </div>
      {periodGone && <p className="member-periods__alert" role="alert">{PERIOD_GONE}</p>}
      {creating && (
        <PeriodForm
          periods={periods}
          onSubmit={record(mode)}
          onCancel={() => finish(mode)}
        />
      )}
      {periods.length === 0 ? (
        <p className="text-md member-periods__empty">{NO_PERIODS}</p>
      ) : (
        <ul className="member-periods__list">
          {periods.map((period) => {
            const editing = mode?.kind === 'edit' && mode.id === period.id;
            const deleting = mode?.kind === 'delete' && mode.id === period.id;
            const range = periodRangeText(period.startsOn, period.endsOn);

            if (editing) {
              return (
                <li className="member-periods__item" key={period.id}>
                  <PeriodForm
                    period={period}
                    onSubmit={correct(mode, period.id)}
                    onCancel={() => finish(mode)}
                  />
                </li>
              );
            }
            return (
              <li
                className={`member-periods__item${deleting ? '' : ' member-periods__item--summary'}`}
                key={period.id}
              >
                <p className="text-md member-periods__range">{range}</p>
                {deleting ? (
                  <DeleteConfirm onConfirm={erase(mode, period.id)} onCancel={() => finish(mode)} />
                ) : (
                  <div className="member-periods__actions">
                    <button
                      type="button"
                      className="member-periods__button"
                      ref={opener(`edit:${period.id}`)}
                      aria-label={editPeriodLabel(range)}
                      onClick={() => open({ kind: 'edit', id: period.id })}
                    >
                      {EDIT_PERIOD}
                    </button>
                    <button
                      type="button"
                      className="member-periods__button"
                      ref={opener(`delete:${period.id}`)}
                      aria-label={deletePeriodLabel(range)}
                      onClick={() => open({ kind: 'delete', id: period.id })}
                    >
                      {DELETE_PERIOD}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

MemberPeriods.propTypes = {
  memberId: PropTypes.string.isRequired,
  /** The payments of the member, newest first. */
  periods: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    startsOn: PropTypes.string,
    endsOn: PropTypes.string,
  })).isRequired,
  /** Reads the member and the payments again; resolves when what is shown is up to date. */
  reload: PropTypes.func.isRequired,
};
