import { useEffect, useRef, useState } from 'react';

import { useAttendance } from '../composition/AttendanceProvider';
import { READ_ERROR, RETRY } from './attendanceCopy';

import './css/attendance-read-error.css';

/**
 * The notice above the public schedule when a signed-in member's attendance could
 * not be read (the periods or the confirmations): without it the cards would show
 * nothing and the member would have no way to try again.
 *
 * It is a read failure only: the provider is active, not ready, and has an error
 * code with no occurrence key. In every other case it renders nothing: an inert
 * provider (a visitor, a signed-out member, a disabled backend, a session that is
 * still loading), data that is ready, a failed action (which its own card shows),
 * and no error at all. So a visitor's page is unchanged.
 *
 * The button reads again through the provider. It stays shown, and disabled, while
 * its own retry is pending (the provider clears the error as the retry starts), and
 * it writes nothing after it unmounts.
 */
function AttendanceReadError() {
  const {
    ready, errorCode, errorKey, retry,
  } = useAttendance();
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const failed = !ready && Boolean(errorCode) && errorKey === null;
  if (!failed && !pending) {
    return null;
  }

  const onRetry = async () => {
    setPending(true);
    try {
      await retry();
    } finally {
      if (mountedRef.current) {
        setPending(false);
      }
    }
  };

  return (
    <div className="attendance-read-error">
      <p className="text-md attendance-read-error__message" role="alert">{READ_ERROR}</p>
      <button
        type="button"
        className="text-sm attendance-read-error__button"
        disabled={pending}
        onClick={onRetry}
      >
        {RETRY}
      </button>
    </div>
  );
}

export default AttendanceReadError;
