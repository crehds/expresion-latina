/**
 * Searches the member directory (Spec: Member Directory) and lists what it finds.
 *
 * The directory is read as soon as the screen opens, with an empty query that
 * asks for everyone, and again each time the form is submitted with what was
 * typed, exactly as typed: the database trims it and takes `%` and `_` as plain
 * characters. What was typed lives in this component's state and nowhere else.
 * It can be a name or an email, so it never goes into the address, the page
 * title, the browser's storage or a log.
 *
 * A search shows a searching status and keeps the button off until it ends, and
 * the answer of an older search never replaces the one of a newer search. A
 * failed search shows the fixed message of its result code in an alert and
 * nothing of what the backend said. When the answer holds as many members as a
 * search asks for, the list may be longer than what is shown, and the screen says
 * so. Without a membership adapter (the backend is off) it renders nothing.
 */
import {
  useCallback, useEffect, useId, useRef, useState,
} from 'react';

import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';
import { MEMBER_SEARCH_LIMIT } from '../adapters/membershipAdapter';
import useMembership from '../composition/useMembership';
import MemberList from './MemberList';
import {
  DIRECTORY_SCOPE,
  NO_MATCHES,
  NO_MEMBERS,
  SEARCHING,
  SEARCH_BUTTON,
  SEARCH_LABEL,
  membersFound,
  resultsLimited,
  searchErrorMessage,
} from './membershipCopy';

import './css/member-search.css';

// What the screen shows while the first search runs.
const FIRST_SEARCH = {
  phase: 'searching', members: [], searched: '', errorCode: null,
};

function statusText({ phase, members, searched }) {
  if (phase === 'searching') {
    return SEARCHING;
  }
  if (phase === 'failed') {
    return '';
  }
  if (members.length > 0) {
    return membersFound(members.length);
  }
  return searched.trim() === '' ? NO_MEMBERS : NO_MATCHES;
}

export default function MemberSearch() {
  const membership = useMembership();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [state, setState] = useState(FIRST_SEARCH);
  // Counts the searches, so that only the latest one may write its answer.
  const latestRef = useRef(0);

  const search = useCallback(async (text) => {
    latestRef.current += 1;
    const mine = latestRef.current;
    setState({
      phase: 'searching', members: [], searched: text, errorCode: null,
    });

    let result;
    try {
      result = await membership.searchMembers(text);
    } catch {
      // The adapter never rejects; if it does, the screen must not wait for ever.
      result = fail(RESULT_CODES.UNKNOWN);
    }
    if (latestRef.current !== mine) {
      return;
    }
    setState(result.ok
      ? {
        phase: 'done', members: result.data, searched: text, errorCode: null,
      }
      : {
        phase: 'failed', members: [], searched: text, errorCode: result.code,
      });
  }, [membership]);

  useEffect(() => {
    if (membership) {
      search('');
    }
  }, [membership, search]);

  if (!membership) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    search(query);
  };

  const searching = state.phase === 'searching';
  const isDone = state.phase === 'done';
  const found = isDone && state.members.length > 0;

  return (
    <div className="member-search">
      <form className="member-search__form" role="search" onSubmit={handleSubmit}>
        <label className="member-search__label" htmlFor={inputId}>{SEARCH_LABEL}</label>
        <div className="member-search__controls">
          <input
            id={inputId}
            className="member-search__input"
            type="search"
            name="q"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="member-search__button" disabled={searching}>
            {searching ? SEARCHING : SEARCH_BUTTON}
          </button>
        </div>
      </form>
      {state.phase === 'failed' && (
        <p className="text-md member-search__alert" role="alert">
          {searchErrorMessage(state.errorCode)}
        </p>
      )}
      <p className="text-md member-search__status" role="status">{statusText(state)}</p>
      {isDone && !found && <p className="text-md member-search__hint">{DIRECTORY_SCOPE}</p>}
      {found && <MemberList members={state.members} />}
      {found && state.members.length >= MEMBER_SEARCH_LIMIT && (
        <p className="text-md member-search__hint">{resultsLimited(MEMBER_SEARCH_LIMIT)}</p>
      )}
    </div>
  );
}
