/**
 * The signed-in member for the whole app (Design: D5, D10).
 *
 * `status` is one of `disabled | idle | loading | signed-out | signed-in |
 * error`. While the backend is off, nothing is read and the status is
 * `disabled`. While it is on, a stored session starts the load on mount, and
 * `start()` starts it on demand (the auth and admin routes); otherwise the
 * status stays `idle` and supabase-js is never loaded. `profile.consentAt ===
 * null` means the consent is still pending; the consent gate reads that.
 *
 * Errors carry only a result code, never a message or member data.
 */
import PropTypes from 'prop-types';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import BackendContext from '../../../shared/backend/BackendContext';
import { hasStoredSession } from '../../../shared/backend/client';

const noop = async () => {};

const DISABLED = {
  status: 'disabled',
  session: null,
  profile: null,
  errorCode: null,
  start: noop,
  refresh: noop,
  signOut: noop,
};

const SessionContext = createContext(DISABLED);

const IDLE = {
  status: 'idle', session: null, profile: null, errorCode: null,
};
const SIGNED_OUT = {
  status: 'signed-out', session: null, profile: null, errorCode: null,
};
const failure = (code, session = null) => ({
  status: 'error', session, profile: null, errorCode: code,
});

export function SessionProvider({ children }) {
  const { enabled, services } = useContext(BackendContext);
  const auth = enabled && services ? services.auth : null;
  const [state, setState] = useState(IDLE);

  // The session the state was last loaded for, the shared load, the auth
  // subscription, and a counter that retires work started before an unmount.
  const sessionRef = useRef(null);
  const startRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const epochRef = useRef(0);

  // Resolves to false only when the profile read failed (the load can be
  // retried). A read for a session that is no longer the current one, or that
  // outlived an unmount, is dropped: it must never write state.
  const loadProfile = useCallback(async (session, epoch) => {
    const result = await auth.getOwnProfile(session.userId);
    const isCurrent = epochRef.current === epoch
      && sessionRef.current?.userId === session.userId;
    if (!isCurrent) {
      return true;
    }
    setState(result.ok
      ? {
        status: 'signed-in', session, profile: result.data, errorCode: null,
      }
      : failure(result.code, session));
    return result.ok;
  }, [auth]);

  const apply = useCallback(async (session, epoch) => {
    sessionRef.current = session;
    if (!session) {
      setState(SIGNED_OUT);
      return true;
    }
    return loadProfile(session, epoch);
  }, [loadProfile]);

  const load = useCallback(async (epoch) => {
    const isStale = () => epochRef.current !== epoch;
    setState((previous) => ({ ...previous, status: 'loading', errorCode: null }));

    const current = await auth.getSession();
    if (isStale()) {
      return true;
    }
    if (!current.ok) {
      setState(failure(current.code));
      return false;
    }
    sessionRef.current = current.data;

    // supabase-js must not be called from inside its own auth callback (it can
    // deadlock), so a change is applied on the next task. The initial event and
    // token refreshes repeat the loaded user and are ignored.
    // A retry after a failed profile read keeps the subscription it already has.
    if (!unsubscribeRef.current) {
      const subscribed = await auth.subscribe((session) => {
        setTimeout(() => {
          const sameUser = (session?.userId ?? null) === (sessionRef.current?.userId ?? null);
          if (epochRef.current === epoch && !sameUser) {
            apply(session, epoch);
          }
        }, 0);
      });
      if (isStale()) {
        if (subscribed.ok) {
          subscribed.data();
        }
        return true;
      }
      if (!subscribed.ok) {
        sessionRef.current = null;
        setState(failure(subscribed.code));
        return false;
      }
      unsubscribeRef.current = subscribed.data;
    }

    return apply(current.data, epoch);
  }, [auth, apply]);

  const start = useCallback(() => {
    if (!auth) {
      return Promise.resolve();
    }
    if (!startRef.current) {
      const epoch = epochRef.current;
      startRef.current = load(epoch).then((loaded) => {
        // A failed load (session, subscription or profile) can be retried; a
        // successful one is shared from now on.
        if (!loaded && epochRef.current === epoch) {
          startRef.current = null;
        }
      });
    }
    return startRef.current;
  }, [auth, load]);

  const refresh = useCallback(async () => {
    if (!auth || !sessionRef.current) {
      return;
    }
    await loadProfile(sessionRef.current, epochRef.current);
  }, [auth, loadProfile]);

  const signOut = useCallback(async () => {
    if (!auth) {
      return;
    }
    const result = await auth.signOut();
    if (result.ok) {
      sessionRef.current = null;
      setState(SIGNED_OUT);
    } else {
      setState(failure(result.code, sessionRef.current));
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }
    if (hasStoredSession()) {
      start();
    }
    return () => {
      epochRef.current += 1;
      startRef.current = null;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [auth, start]);

  const value = useMemo(() => (auth
    ? {
      ...state, start, refresh, signOut,
    }
    : DISABLED), [auth, state, start, refresh, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

SessionProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useSession = () => useContext(SessionContext);

export default SessionContext;
