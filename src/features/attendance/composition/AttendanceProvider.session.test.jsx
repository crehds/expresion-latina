// The administrator flag with the real SessionProvider (the advisory
// R3-admin-flag-profile-race of review-b7af4f58c66c8dc2).
//
// AttendanceProvider takes `isAdmin` from the session profile, but its readiness
// waits only for its own two reads (the periods and the confirmations). That is
// enough, and this file pins why, so that nobody breaks it by accident: an
// administrator must never meet the inactive state of a member (the prompt to enrol
// that a tap on a check opens) while the profile is still on its way.
//
// - SessionProvider turns `signed-in` in the same state that holds the profile it
//   has read (loadProfile, which awaits getOwnProfile before it sets anything), so
//   there is no render with a signed-in session and the profile still pending.
// - AttendanceProvider is active only for a signed-in session, so it starts its
//   two reads after the profile is known. There is no moment with the data ready
//   and `isAdmin` still to be learnt.
// - A refresh swaps one profile for the next in one state too.
//
// Only the auth adapter, the attendance adapter and the membership adapter are
// fakes; the session provider and everything above it are the real ones.
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { useEffect } from 'react';

import BackendContext from '../../../shared/backend/BackendContext';
import { SessionProvider, useSession } from '../../accounts/composition/SessionProvider';
import { membershipPrompt } from '../domain/rules';
import MembershipRequiredModal from '../ui/MembershipRequiredModal';
import SessionAttendance from '../ui/SessionAttendance';
import AttendanceProvider, { useAttendance } from './AttendanceProvider';

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const MEMBER_PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};
const ADMIN_PROFILE = { ...MEMBER_PROFILE, isAdmin: true };

// Tuesday 2026-10-20, 10:00 in Lima (UTC-05:00); the next Monday class is on the 26th.
const NOW = new Date('2026-10-20T15:00:00Z');
const MONDAY = {
  id: 'lun-1900',
  day: { weekday: 1 },
  slot: { start: '19:00', end: '20:00' },
  genre: { id: 'salsa', name: 'Salsa', kind: 'dance' },
  room: 'Sala 1',
};

const ok = (data) => ({ ok: true, data });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeServices(profileReads) {
  const reads = [...profileReads];
  const unsubscribe = vi.fn();
  return {
    auth: {
      getSession: vi.fn(async () => ok(SESSION)),
      subscribe: vi.fn(async () => ok(unsubscribe)),
      getOwnProfile: vi.fn(() => reads.shift()),
    },
    attendance: {
      listOwnConfirmations: vi.fn(async () => ok([])),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: { listOwnPeriods: vi.fn(async () => ok([])) },
  };
}

// What each render of the tree saw, in order.
const snapshots = [];
const seen = { current: null };

function Probe() {
  const session = useSession();
  const attendance = useAttendance();
  seen.current = session;
  snapshots.push({
    status: session.status,
    hasProfile: session.profile !== null,
    ready: attendance.ready,
    isAdmin: attendance.isAdmin,
    // What the prompt to enrol would say to this viewer, in this very render.
    prompt: membershipPrompt({
      membership: attendance.membership, now: attendance.now, isAdmin: attendance.isAdmin,
    }),
  });
  return null;
}

function Starter() {
  const { start } = useSession();
  useEffect(() => {
    start();
  }, [start]);
  return null;
}

// Every text the page ever drew, not only the last one: a notice that flashed for a
// single render would be gone by the time the test looks.
function watchDrawnText(container) {
  const drawn = [];
  const remember = (records) => records.forEach((record) => {
    record.addedNodes.forEach((node) => drawn.push(node.textContent));
  });
  const observer = new MutationObserver(remember);
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  return {
    stop: () => {
      remember(observer.takeRecords());
      observer.disconnect();
      return drawn;
    },
  };
}

async function renderTree(services) {
  const view = render(
    <BackendContext.Provider value={{ enabled: true, services }}>
      <SessionProvider>
        <AttendanceProvider>
          <Starter />
          <Probe />
          <SessionAttendance session={MONDAY} whatsappLink="https://wa.me/51960507583" />
          <MembershipRequiredModal whatsappLink="https://wa.me/51960507583" />
        </AttendanceProvider>
      </SessionProvider>
    </BackendContext.Provider>,
  );
  const drawn = watchDrawnText(view.container);
  await act(async () => {});
  return { ...view, drawn };
}

describe('the administrator flag with the real session provider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    snapshots.length = 0;
    seen.current = null;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('while the profile is still being read', () => {
    it('reads nothing of the attendance and draws nothing', async () => {
      const profile = deferred();
      const services = fakeServices([profile.promise]);

      const { container, drawn } = await renderTree(services);

      expect(services.auth.getOwnProfile).toHaveBeenCalledTimes(1);
      expect(seen.current.status).toBe('loading');
      expect(services.membership.listOwnPeriods).not.toHaveBeenCalled();
      expect(services.attendance.listOwnConfirmations).not.toHaveBeenCalled();
      expect(container).toBeEmptyDOMElement();
      expect(drawn.stop()).toEqual([]);
    });
  });

  describe('for an administrator with no paid period', () => {
    async function adminWhoseProfileArrivesLate() {
      const profile = deferred();
      const services = fakeServices([profile.promise]);
      const view = await renderTree(services);
      await act(async () => { profile.resolve(ok(ADMIN_PROFILE)); });
      return { ...view, services };
    }

    it('starts the attendance reads only after the profile, and ends with the toggle', async () => {
      const { services } = await adminWhoseProfileArrivesLate();

      expect(seen.current.status).toBe('signed-in');
      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(1);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeEnabled();
    });

    it('never has the data ready while the flag is still false, in any render', async () => {
      await adminWhoseProfileArrivesLate();

      // The check is worth something only if the data did get ready as an administrator.
      expect(snapshots.some((one) => one.ready && one.isAdmin)).toBe(true);
      expect(snapshots.filter((one) => one.ready && !one.isAdmin)).toEqual([]);
    });

    it('is never signed in without the profile it was loaded with, in any render', async () => {
      await adminWhoseProfileArrivesLate();

      expect(snapshots.some((one) => one.status === 'signed-in')).toBe(true);
      expect(snapshots.filter((one) => one.status === 'signed-in' && !one.hasProfile)).toEqual([]);
    });

    it('never has a prompt to enrol, not even for one render, and a tap opens none', async () => {
      const { container, drawn } = await adminWhoseProfileArrivesLate();

      expect(snapshots.some((one) => one.ready)).toBe(true);
      expect(snapshots.filter((one) => one.prompt !== null)).toEqual([]);
      expect(container).not.toHaveTextContent('Tu membresía');
      expect(drawn.stop().filter((text) => text.includes('Tu membresía'))).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // The counterpart: the same tree with a member has the prompt, so the absence above
  // is not an artefact of the page failing to draw anything.
  describe('for a member with no paid period', () => {
    it('has the prompt once the data is ready, in no render before, and a tap opens it', async () => {
      const profile = deferred();
      const services = fakeServices([profile.promise]);
      const { drawn } = await renderTree(services);
      expect(snapshots.filter((one) => one.prompt !== null)).toEqual([]);

      await act(async () => { profile.resolve(ok(MEMBER_PROFILE)); });

      expect(snapshots.filter((one) => one.ready && one.isAdmin)).toEqual([]);
      expect(snapshots.filter((one) => !one.ready && one.prompt !== null)).toEqual([]);
      expect(snapshots.some((one) => one.ready && one.prompt?.kind === 'enrol')).toBe(true);
      // The member sees the check like everyone: tapping it asks them to enrol.
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }));
      await act(async () => {});
      expect(screen.getByRole('dialog', { name: 'Necesitas una membresía activa' })).toBeInTheDocument();
      drawn.stop();
    });
  });

  describe('when the profile is read again', () => {
    it('keeps the old profile until the new one arrives, then swaps them in one render', async () => {
      const refreshed = deferred();
      const services = fakeServices([Promise.resolve(ok(MEMBER_PROFILE)), refreshed.promise]);
      const { drawn } = await renderTree(services);
      expect(snapshots.at(-1).prompt).toEqual({ kind: 'enrol' });

      let refreshing;
      await act(async () => { refreshing = seen.current.refresh(); });
      // Still the member of before: the session never goes through "no profile".
      expect(seen.current.status).toBe('signed-in');
      expect(seen.current.profile.isAdmin).toBe(false);
      expect(snapshots.at(-1).prompt).toEqual({ kind: 'enrol' });

      await act(async () => {
        refreshed.resolve(ok(ADMIN_PROFILE));
        await refreshing;
      });

      expect(seen.current.profile.isAdmin).toBe(true);
      expect(snapshots.at(-1).prompt).toBeNull();
      expect(screen.getByRole('button', { name: 'Confirmar asistencia' })).toBeEnabled();
      expect(snapshots.filter((one) => one.status === 'signed-in' && !one.hasProfile)).toEqual([]);
      drawn.stop();
    });
  });
});
