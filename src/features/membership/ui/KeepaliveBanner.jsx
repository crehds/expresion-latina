/**
 * The notice above every admin page that the keep-alive has not pinged the
 * project lately (Spec: Keep-Alive Failure Detection).
 *
 * It reads the instant of the last ping (`ops_heartbeat.last_ping_at`, which only
 * an administrator can read) once, when it appears, and says when the last one
 * was and how many days ago if it is too old. A ping that is recent enough says
 * nothing, and neither does a project with no ping recorded (owner decision: it
 * is not told apart from a new one). It never claims that the workflow
 * failed, because that timestamp can be refreshed by anyone holding the
 * publishable key: it only reports what is recorded and points to the run
 * history of the workflow, the real signal.
 *
 * The number of days it waits comes from the build-time variable
 * `VITE_KEEPALIVE_ALERT_DAYS` (3 when unset; `off` turns the banner off, and
 * then the heartbeat is not even read). The build refuses a malformed value, so
 * the dev server and the tests are the only places that meet one, and there it
 * counts as the default. The variable is read when the banner is drawn, not when
 * the module loads, so tests can change it with `vi.stubEnv`.
 *
 * It is a courtesy and never gets in the way: nothing is drawn until the answer
 * arrives (a request that cannot connect can take several seconds to give up),
 * and nothing is drawn if there is no membership adapter, if the read fails
 * whatever the reason, or if the instant cannot be read. The answer of a read
 * the banner has moved on from is dropped. It is a polite live region, not an
 * alert: nothing here is urgent.
 */
import { useEffect, useState } from 'react';

import useMembership from '../composition/useMembership';
import { keepaliveStatus, resolveAlertDays } from '../domain/keepaliveAlert';
import { keepaliveStaleText } from './membershipCopy';

import './css/keepalive-banner.css';

export default function KeepaliveBanner() {
  const membership = useMembership();
  const days = resolveAlertDays(import.meta.env.VITE_KEEPALIVE_ALERT_DAYS);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    if (!membership || days === null) {
      return undefined;
    }

    let current = true;
    async function read() {
      try {
        const result = await membership.getLastPing();
        if (current && result.ok) {
          setCheck(keepaliveStatus({ lastPingAt: result.data, now: new Date(), days }));
        }
      } catch {
        // Whatever went wrong, the admin pages carry on without the notice.
      }
    }
    read();

    return () => {
      current = false;
    };
  }, [membership, days]);

  const text = check?.status === 'stale'
    ? keepaliveStaleText(check.lastPingAt, check.daysAgo)
    : null;

  return text && <p className="text-md keepalive-banner" role="status">{text}</p>;
}
