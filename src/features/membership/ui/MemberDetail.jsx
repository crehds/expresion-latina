/**
 * The page of one member (Spec: Member Directory, Recording Paid Periods,
 * Correcting Paid Periods): who they are, where their payments stand, and the
 * payments themselves, which the administrator can record, correct and delete.
 *
 * The member and the payments are read together, by the id the page took from
 * its address, and shown once both have arrived. The header says what the server
 * sent, the same status and date the directory shows, and never something worked
 * out from the list. After every change `MemberPeriods` asks this page to read
 * both again, so what is on the screen is what the database holds and nothing is
 * guessed. That read keeps the member on the screen, so a form that is open
 * stays where it is; only the first read and a retry show the loading line. A
 * read that is not the latest never replaces a newer one.
 *
 * An id that is not a UUID is answered as a member who is not there, without
 * asking the backend anything; so is a member the directory does not list (from
 * here, one who has not accepted the privacy notice or confirmed their email
 * looks like one who does not exist). A failed read shows the fixed message of
 * its result code and nothing of what the backend said, with a button to read
 * again. The id is the only thing about the member that travels in an address.
 * Without a membership adapter (the backend is off) it renders nothing.
 */
import PropTypes from 'prop-types';
import {
  useCallback, useEffect, useId, useRef, useState,
} from 'react';
import { Link } from 'react-router-dom';

import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';
import { isUuid } from '../../../shared/uuid';
import useMembership from '../composition/useMembership';
import MemberPeriods from './MemberPeriods';
import {
  ACTIVE,
  BACK_TO_MEMBERS,
  DIRECTORY_SCOPE,
  INACTIVE,
  LOADING_MEMBER,
  MEMBER_NOT_FOUND,
  MEMBER_NOT_FOUND_TITLE,
  MEMBER_TITLE,
  RETRY,
  memberErrorMessage,
  paymentLine,
} from './membershipCopy';

import './css/member-detail.css';

const LOADING = { phase: 'loading' };
const MISSING = { phase: 'missing' };

// What the screen shows once both reads have answered. A member who is not there
// is not a failure; every other failure of either read is.
function answerOf(memberResult, periodsResult) {
  if (!memberResult.ok) {
    return memberResult.code === RESULT_CODES.NOT_FOUND
      ? MISSING
      : { phase: 'failed', errorCode: memberResult.code };
  }
  if (!periodsResult.ok) {
    return { phase: 'failed', errorCode: periodsResult.code };
  }
  return { phase: 'ready', member: memberResult.data, periods: periodsResult.data };
}

// The heading names the member. A member with no name leaves it to the plain
// title, since an empty heading names nothing.
function titleOf(state) {
  if (state.phase === 'missing') {
    return MEMBER_NOT_FOUND_TITLE;
  }
  const name = state.phase === 'ready' ? state.member.fullName : '';
  return typeof name === 'string' && name.trim() !== '' ? name : MEMBER_TITLE;
}

function MemberView({ memberId = undefined }) {
  const membership = useMembership();
  const titleId = useId();
  const valid = isUuid(memberId);
  const [state, setState] = useState(valid ? LOADING : MISSING);
  // Counts the reads, so that only the latest one may write its answer.
  const latestRef = useRef(0);

  // Resolves once the answer has been written, or dropped for a newer read's.
  const read = useCallback(async () => {
    latestRef.current += 1;
    const mine = latestRef.current;

    let memberResult;
    let periodsResult;
    try {
      [memberResult, periodsResult] = await Promise.all([
        membership.getMember(memberId),
        membership.listPeriods(memberId),
      ]);
    } catch {
      // The adapter never rejects; if it does, the screen must not wait for ever.
      memberResult = fail(RESULT_CODES.UNKNOWN);
      periodsResult = memberResult;
    }
    if (latestRef.current === mine) {
      setState(answerOf(memberResult, periodsResult));
    }
  }, [membership, memberId]);

  useEffect(() => {
    if (membership && valid) {
      read();
    }
  }, [membership, valid, read]);

  if (!membership) {
    return null;
  }

  const retry = () => {
    setState(LOADING);
    read();
  };

  const { phase } = state;

  return (
    <section className="member-detail" aria-labelledby={titleId}>
      <Link className="member-detail__back" to="/admin/members">{BACK_TO_MEMBERS}</Link>
      <h2 className="heading-sm member-detail__title" id={titleId}>{titleOf(state)}</h2>
      {phase === 'loading' && (
        <p className="text-md member-detail__message" role="status">{LOADING_MEMBER}</p>
      )}
      {phase === 'missing' && (
        <>
          <p className="text-md member-detail__message">{MEMBER_NOT_FOUND}</p>
          <p className="text-md member-detail__hint">{DIRECTORY_SCOPE}</p>
        </>
      )}
      {phase === 'failed' && (
        <>
          <p className="text-md member-detail__alert" role="alert">
            {memberErrorMessage(state.errorCode)}
          </p>
          <button type="button" className="member-detail__button" onClick={retry}>
            {RETRY}
          </button>
        </>
      )}
      {phase === 'ready' && (
        <>
          <p className="text-md member-detail__email">{state.member.email}</p>
          <p className="text-md member-detail__summary">
            <span
              className={`member-detail__status member-detail__status--${state.member.isActive ? 'active' : 'inactive'}`}
            >
              {state.member.isActive ? ACTIVE : INACTIVE}
            </span>
            <span className="member-detail__payment">{paymentLine(state.member)}</span>
          </p>
          <MemberPeriods memberId={memberId} periods={state.periods} reload={read} />
        </>
      )}
    </section>
  );
}

MemberView.propTypes = {
  memberId: PropTypes.string,
};

export default function MemberDetail({ memberId = undefined }) {
  // A new id starts a new screen: nothing of the member before may stay on it
  // while the next one is read.
  return <MemberView key={memberId} memberId={memberId} />;
}

MemberDetail.propTypes = {
  /** The id taken from the address; anything that is not a UUID is answered as not found. */
  memberId: PropTypes.string,
};
