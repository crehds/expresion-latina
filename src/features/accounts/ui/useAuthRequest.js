/**
 * The state every sign-in control shares while it waits for the backend.
 *
 * `run(action)` takes an async function that resolves to an adapter result
 * (`{ ok, data }` or `{ ok: false, code }`) and hands that result back. While
 * the action is pending `busy` is true, so a control can disable itself; when
 * it fails, `errorCode` holds the result code, and a rejection counts as
 * `UNKNOWN`. Nothing else of the failure is kept, so a control can only ever
 * show the fixed message of a code. `busy` always ends, whatever the action
 * did.
 */
import { useCallback, useState } from 'react';
import { RESULT_CODES, fail } from '../../../shared/backend/resultCodes';

export default function useAuthRequest() {
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  const clear = useCallback(() => setErrorCode(null), []);

  const run = useCallback(async (action) => {
    setBusy(true);
    setErrorCode(null);
    try {
      const result = await action();
      if (!result.ok) {
        setErrorCode(result.code);
      }
      return result;
    } catch {
      setErrorCode(RESULT_CODES.UNKNOWN);
      return fail(RESULT_CODES.UNKNOWN);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy, errorCode, run, clear,
  };
}
