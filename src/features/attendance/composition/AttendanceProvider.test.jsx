import { act, renderHook } from '@testing-library/react';
import PropTypes from 'prop-types';
import { useMemo } from 'react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import { occurrenceKey } from '../domain/occurrences';
import AttendanceProvider, { useAttendance } from './AttendanceProvider';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const OTHER_USER = '5f3d9c21-8a64-4b7e-b1c0-6e2a9d4f8c13';

// 2026-10-20 10:00 in Lima (UTC-05:00).
const NOW = new Date('2026-10-20T15:00:00Z');

const occurrence = (overrides = {}) => ({
  classDate: '2026-10-26',
  startTime: '19:00',
  endTime: '20:00',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
  startsAt: new Date('2026-10-27T00:00:00Z'),
  ...overrides,
});

const MONDAY = occurrence();
const TUESDAY = occurrence({ classDate: '2026-10-27', genreId: 'bachata', genreName: 'Bachata' });

const PERIODS = [{ startsOn: '2026-10-01', endsOn: '2026-10-31' }];

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// A promise the test settles by hand, to hold a request in flight.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeServices({ periods = ok(PERIODS), confirmations = ok([]) } = {}) {
  return {
    attendance: {
      listOwnConfirmations: vi.fn(async () => confirmations),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: {
      listOwnPeriods: vi.fn(async () => periods),
    },
  };
}

const signedIn = (userId = USER) => ({
  status: 'signed-in', session: { userId, email: 'a@example.test' }, profile: { id: userId },
});

function wrapperFor({
  enabled = true, services, session = signedIn(), getSession = () => session,
}) {
  function Wrapper({ children }) {
    const backend = useMemo(() => ({ enabled, services }), []);
    return (
      <BackendContext.Provider value={backend}>
        <SessionContext.Provider value={getSession()}>
          <AttendanceProvider>{children}</AttendanceProvider>
        </SessionContext.Provider>
      </BackendContext.Provider>
    );
  }
  Wrapper.propTypes = { children: PropTypes.node.isRequired };
  return Wrapper;
}

async function mount(options = {}) {
  const services = options.services ?? fakeServices();
  const view = renderHook(() => useAttendance(), {
    wrapper: wrapperFor({ ...options, services: options.noServices ? null : services }),
  });
  await act(async () => {});
  return { ...view, services };
}

const callsOf = ({ attendance, membership }) => (
  attendance.listOwnConfirmations.mock.calls.length
  + membership.listOwnPeriods.mock.calls.length
  + attendance.confirm.mock.calls.length
  + attendance.cancel.mock.calls.length
);

describe('AttendanceProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when it must stay inert', () => {
    it.each(['disabled', 'idle', 'loading', 'signed-out', 'error'])(
      'makes no adapter call and ticks no timer while the session is %s',
      async (status) => {
        const services = fakeServices();
        const session = { status, session: null, profile: null };

        const { result } = await mount({ services, session });

        expect(callsOf(services)).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(result.current.ready).toBe(false);
        expect(result.current.membership).toBeNull();
      },
    );

    it('makes no adapter call while the backend is disabled, even with services at hand', async () => {
      const services = fakeServices();

      const { result } = await mount({ services, enabled: false });

      expect(callsOf(services)).toBe(0);
      expect(result.current.ready).toBe(false);
    });

    it('makes no call without services', async () => {
      const { result, services } = await mount({ noServices: true });

      expect(callsOf(services)).toBe(0);
      expect(result.current.ready).toBe(false);
    });

    it('makes no call when a signed-in session has no user id', async () => {
      const services = fakeServices();
      const session = { status: 'signed-in', session: null, profile: null };

      await mount({ services, session });

      expect(callsOf(services)).toBe(0);
    });

    it('exposes empty, safe values', async () => {
      const { result } = await mount({ enabled: false });

      expect(result.current).toMatchObject({
        ready: false,
        membership: null,
        isAdmin: false,
        busyKey: null,
        errorCode: null,
        errorKey: null,
      });
      expect(result.current.confirmedKeys).toEqual(new Set());
      expect(result.current.now).toBeInstanceOf(Date);
    });
  });

  describe('reading', () => {
    it('reads the own periods and confirmations once, from the Lima today on', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY, TUESDAY]) });

      const { result } = await mount({ services });

      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(1);
      expect(services.membership.listOwnPeriods).toHaveBeenCalledWith({
        userId: USER, fromDate: '2026-10-20',
      });
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledWith({
        userId: USER, fromDate: '2026-10-20',
      });
      expect(result.current.ready).toBe(true);
      expect(result.current.membership).toEqual({ periods: PERIODS });
      expect(result.current.confirmedKeys).toEqual(
        new Set([occurrenceKey(MONDAY), occurrenceKey(TUESDAY)]),
      );
    });

    it('is not ready, and shows no membership, while the reads are in flight', async () => {
      const services = fakeServices();
      const held = deferred();
      services.membership.listOwnPeriods.mockReturnValue(held.promise);

      const { result } = await mount({ services });

      expect(result.current.ready).toBe(false);
      expect(result.current.membership).toBeNull();

      await act(async () => { held.resolve(ok(PERIODS)); });

      expect(result.current.ready).toBe(true);
    });

    it('does not read again on a re-render', async () => {
      const services = fakeServices();

      const { rerender } = await mount({ services });
      rerender();
      await act(async () => {});

      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(1);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
    });

    it('drops a read that finishes after the session ended', async () => {
      const services = fakeServices();
      const held = deferred();
      services.membership.listOwnPeriods.mockReturnValue(held.promise);
      let session = signedIn();
      const view = renderHook(() => useAttendance(), {
        wrapper: wrapperFor({ services, getSession: () => session }),
      });
      await act(async () => {});

      session = { status: 'signed-out', session: null, profile: null };
      view.rerender();
      await act(async () => { held.resolve(ok(PERIODS)); });

      expect(view.result.current.ready).toBe(false);
      expect(view.result.current.membership).toBeNull();
    });

    it('drops a read of the first user that finishes after the second user was read', async () => {
      const services = fakeServices();
      const held = deferred();
      services.membership.listOwnPeriods.mockReturnValueOnce(held.promise);
      let session = signedIn(USER);
      const view = renderHook(() => useAttendance(), {
        wrapper: wrapperFor({ services, getSession: () => session }),
      });
      await act(async () => {});
      const otherPeriods = [{ startsOn: '2026-11-01', endsOn: '2026-11-30' }];
      services.membership.listOwnPeriods.mockResolvedValue(ok(otherPeriods));

      session = signedIn(OTHER_USER);
      view.rerender();
      await act(async () => {});
      await act(async () => { held.resolve(ok(PERIODS)); });

      expect(view.result.current.membership).toEqual({ periods: otherPeriods });
    });

    it('drops a read that finishes after the component unmounted', async () => {
      const services = fakeServices();
      const held = deferred();
      services.membership.listOwnPeriods.mockReturnValue(held.promise);
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = await mount({ services });
      unmount();
      await act(async () => { held.resolve(ok(PERIODS)); });

      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it('reads again for another user and forgets the first one', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      let session = signedIn(USER);
      const view = renderHook(() => useAttendance(), {
        wrapper: wrapperFor({ services, getSession: () => session }),
      });
      await act(async () => {});
      services.attendance.listOwnConfirmations.mockResolvedValue(ok([]));

      session = signedIn(OTHER_USER);
      view.rerender();
      await act(async () => {});

      expect(services.membership.listOwnPeriods).toHaveBeenLastCalledWith({
        userId: OTHER_USER, fromDate: '2026-10-20',
      });
      expect(view.result.current.confirmedKeys).toEqual(new Set());
    });
  });

  // The administrator has free access to classes, so the schedule needs to know
  // who one is. The flag comes from the session profile, and the database stays
  // the authority: it only decides which control a card offers.
  describe('the administrator flag', () => {
    const withProfile = (profile) => ({
      status: 'signed-in', session: { userId: USER, email: 'a@example.test' }, profile,
    });

    it('is true for an administrator, from the session profile', async () => {
      const { result } = await mount({ session: withProfile({ id: USER, isAdmin: true }) });

      expect(result.current.isAdmin).toBe(true);
    });

    it.each([
      ['a member', { id: USER, isAdmin: false }],
      ['a profile that says nothing about it', { id: USER }],
      ['a flag that is not a boolean', { id: USER, isAdmin: 'true' }],
      ['no profile at all', null],
    ])('is false for %s', async (_label, profile) => {
      const { result } = await mount({ session: withProfile(profile) });

      expect(result.current.isAdmin).toBe(false);
    });

    it('stays false while the provider is inert, whatever the profile says', async () => {
      const { result } = await mount({
        enabled: false, session: withProfile({ id: USER, isAdmin: true }),
      });

      expect(result.current.isAdmin).toBe(false);
    });

    it('does not change what is read: an administrator reads their own rows only', async () => {
      const services = fakeServices();

      await mount({ services, session: withProfile({ id: USER, isAdmin: true }) });

      expect(services.membership.listOwnPeriods).toHaveBeenCalledWith({
        userId: USER, fromDate: '2026-10-20',
      });
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledWith({
        userId: USER, fromDate: '2026-10-20',
      });
    });
  });

  describe('when a read fails', () => {
    it('reports the code, stays not ready, and retry reads again', async () => {
      const services = fakeServices({ periods: fail('NETWORK') });

      const { result } = await mount({ services });

      expect(result.current.ready).toBe(false);
      expect(result.current.errorCode).toBe('NETWORK');
      expect(result.current.errorKey).toBeNull();

      services.membership.listOwnPeriods.mockResolvedValue(ok(PERIODS));
      await act(async () => { await result.current.retry(); });

      expect(result.current.ready).toBe(true);
      expect(result.current.errorCode).toBeNull();
      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(2);
    });

    it('fails when only the confirmations read fails', async () => {
      const services = fakeServices({ confirmations: fail('UNKNOWN') });

      const { result } = await mount({ services });

      expect(result.current.ready).toBe(false);
      expect(result.current.errorCode).toBe('UNKNOWN');
    });
  });

  describe('confirm', () => {
    it('confirms through the adapter, marks busy meanwhile, and then holds the key', async () => {
      const services = fakeServices();
      const held = deferred();
      services.attendance.confirm.mockReturnValue(held.promise);
      const { result } = await mount({ services });

      let pending;
      act(() => { pending = result.current.confirm(MONDAY); });

      expect(result.current.busyKey).toBe(occurrenceKey(MONDAY));
      expect(services.attendance.confirm).toHaveBeenCalledWith(MONDAY);

      await act(async () => { held.resolve(ok(null)); await pending; });

      expect(result.current.busyKey).toBeNull();
      expect(result.current.confirmedKeys.has(occurrenceKey(MONDAY))).toBe(true);
      expect(result.current.errorCode).toBeNull();
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
    });

    it('ignores a second action while one is in flight', async () => {
      const services = fakeServices();
      const held = deferred();
      services.attendance.confirm.mockReturnValue(held.promise);
      const { result } = await mount({ services });

      act(() => { result.current.confirm(MONDAY); });
      act(() => { result.current.confirm(TUESDAY); });
      act(() => { result.current.cancel(TUESDAY); });
      await act(async () => { held.resolve(ok(null)); });

      expect(services.attendance.confirm).toHaveBeenCalledTimes(1);
      expect(services.attendance.cancel).not.toHaveBeenCalled();
    });

    it('on FORBIDDEN shows the code against that class and reads again', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValue(fail('FORBIDDEN'));
      const { result } = await mount({ services });

      await act(async () => { await result.current.confirm(MONDAY); });

      expect(result.current.errorCode).toBe('FORBIDDEN');
      expect(result.current.errorKey).toBe(occurrenceKey(MONDAY));
      expect(result.current.confirmedKeys.has(occurrenceKey(MONDAY))).toBe(false);
      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(2);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(2);
    });

    it('on another failure shows the code and does not read again', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValue(fail('NETWORK'));
      const { result } = await mount({ services });

      await act(async () => { await result.current.confirm(MONDAY); });

      expect(result.current.errorCode).toBe('NETWORK');
      expect(result.current.errorKey).toBe(occurrenceKey(MONDAY));
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
    });

    it('clears an earlier error when the next action starts', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValueOnce(fail('NETWORK'));
      const { result } = await mount({ services });
      await act(async () => { await result.current.confirm(MONDAY); });

      await act(async () => { await result.current.confirm(MONDAY); });

      expect(result.current.errorCode).toBeNull();
      expect(result.current.errorKey).toBeNull();
    });

    it('keeps the old data, and not ready false, when the read after a refusal fails', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValue(fail('FORBIDDEN'));
      const { result } = await mount({ services });
      services.membership.listOwnPeriods.mockResolvedValue(fail('NETWORK'));

      await act(async () => { await result.current.confirm(MONDAY); });

      expect(result.current.ready).toBe(true);
      expect(result.current.membership).toEqual({ periods: PERIODS });
    });
  });

  describe('cancel', () => {
    it('cancels through the adapter and drops the key', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY, TUESDAY]) });
      const { result } = await mount({ services });

      await act(async () => { await result.current.cancel(MONDAY); });

      expect(services.attendance.cancel).toHaveBeenCalledWith(MONDAY);
      expect(result.current.confirmedKeys).toEqual(new Set([occurrenceKey(TUESDAY)]));
      expect(result.current.busyKey).toBeNull();
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
    });

    it('on STARTED reads again, and clears the failure when the confirmation is already gone', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      services.attendance.cancel.mockResolvedValue(fail('STARTED'));
      const { result } = await mount({ services });
      services.attendance.listOwnConfirmations.mockResolvedValue(ok([]));

      await act(async () => { await result.current.cancel(MONDAY); });

      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(2);
      expect(result.current.confirmedKeys.has(occurrenceKey(MONDAY))).toBe(false);
      // It was cancelled elsewhere, so the class did not start: nothing to report.
      expect(result.current.errorCode).toBeNull();
      expect(result.current.errorKey).toBeNull();
    });

    it('on STARTED keeps the failure when the confirmation is still there (the class started)', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      services.attendance.cancel.mockResolvedValue(fail('STARTED'));
      const { result } = await mount({ services });

      await act(async () => { await result.current.cancel(MONDAY); });

      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(2);
      expect(result.current.confirmedKeys.has(occurrenceKey(MONDAY))).toBe(true);
      expect(result.current.errorCode).toBe('STARTED');
      expect(result.current.errorKey).toBe(occurrenceKey(MONDAY));
    });

    it('on STARTED keeps the failure when the read after it fails', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      services.attendance.cancel.mockResolvedValue(fail('STARTED'));
      const { result } = await mount({ services });
      services.attendance.listOwnConfirmations.mockResolvedValue(fail('NETWORK'));

      await act(async () => { await result.current.cancel(MONDAY); });

      expect(result.current.errorCode).toBe('STARTED');
    });

    it('does not clear a failure of another class when it settles a STARTED', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY, TUESDAY]) });
      services.attendance.cancel.mockResolvedValue(fail('STARTED'));
      const { result } = await mount({ services });
      const held = deferred();
      services.attendance.listOwnConfirmations.mockReturnValue(held.promise);

      let pending;
      act(() => { pending = result.current.cancel(MONDAY); });
      await act(async () => {});
      services.attendance.cancel.mockResolvedValue(fail('NETWORK'));
      await act(async () => { await result.current.cancel(TUESDAY); });
      await act(async () => { held.resolve(ok([TUESDAY])); await pending; });

      expect(result.current.errorCode).toBe('NETWORK');
      expect(result.current.errorKey).toBe(occurrenceKey(TUESDAY));
    });

    it('on another failure keeps the key and does not read again', async () => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      services.attendance.cancel.mockResolvedValue(fail('NETWORK'));
      const { result } = await mount({ services });

      await act(async () => { await result.current.cancel(MONDAY); });

      expect(result.current.errorCode).toBe('NETWORK');
      expect(result.current.confirmedKeys.has(occurrenceKey(MONDAY))).toBe(true);
      expect(services.attendance.listOwnConfirmations).toHaveBeenCalledTimes(1);
    });
  });

  // The request runner never rejects, so these are latent today; an adapter that
  // does must still free the provider and say so.
  describe('when an adapter call rejects', () => {
    it.each(['confirm', 'cancel'])('frees the busy state after a rejecting %s and reports UNKNOWN', async (method) => {
      const services = fakeServices({ confirmations: ok([MONDAY]) });
      services.attendance[method].mockRejectedValueOnce(new Error('boom'));
      const { result } = await mount({ services });

      await act(async () => { await result.current[method](MONDAY); });

      expect(result.current.busyKey).toBeNull();
      expect(result.current.errorCode).toBe('UNKNOWN');
      expect(result.current.errorKey).toBe(occurrenceKey(MONDAY));

      await act(async () => { await result.current[method](MONDAY); });

      expect(services.attendance[method]).toHaveBeenCalledTimes(2);
      expect(result.current.errorCode).toBeNull();
    });

    it('writes nothing for a rejecting action that went stale', async () => {
      const services = fakeServices();
      let reject;
      services.attendance.confirm.mockReturnValue(new Promise((_, fails) => { reject = fails; }));
      let session = signedIn(USER);
      const view = renderHook(() => useAttendance(), {
        wrapper: wrapperFor({ services, getSession: () => session }),
      });
      await act(async () => {});
      act(() => { view.result.current.confirm(MONDAY); });

      session = signedIn(OTHER_USER);
      view.rerender();
      await act(async () => {});
      await act(async () => { reject(new Error('boom')); });

      expect(view.result.current.errorCode).toBeNull();
      expect(view.result.current.busyKey).toBeNull();
    });

    it.each(['listOwnPeriods', 'listOwnConfirmations'])('reports UNKNOWN when %s rejects, and retry loads', async (method) => {
      const services = fakeServices();
      const owner = method === 'listOwnPeriods' ? services.membership : services.attendance;
      owner[method].mockRejectedValueOnce(new Error('boom'));

      const { result } = await mount({ services });

      expect(result.current.ready).toBe(false);
      expect(result.current.errorCode).toBe('UNKNOWN');
      expect(result.current.errorKey).toBeNull();

      await act(async () => { await result.current.retry(); });

      expect(result.current.ready).toBe(true);
      expect(result.current.errorCode).toBeNull();
    });

    it('keeps what is shown and the refusal when the read after a refusal rejects', async () => {
      const services = fakeServices();
      services.attendance.confirm.mockResolvedValue(fail('FORBIDDEN'));
      const { result } = await mount({ services });
      services.membership.listOwnPeriods.mockRejectedValue(new Error('boom'));

      await act(async () => { await result.current.confirm(MONDAY); });

      expect(result.current.ready).toBe(true);
      expect(result.current.membership).toEqual({ periods: PERIODS });
      expect(result.current.errorCode).toBe('FORBIDDEN');
    });

    it('drops a rejecting read that went stale', async () => {
      const services = fakeServices();
      let reject;
      services.membership.listOwnPeriods.mockReturnValueOnce(
        new Promise((_, fails) => { reject = fails; }),
      );
      let session = signedIn(USER);
      const view = renderHook(() => useAttendance(), {
        wrapper: wrapperFor({ services, getSession: () => session }),
      });
      await act(async () => {});

      session = signedIn(OTHER_USER);
      view.rerender();
      await act(async () => {});
      await act(async () => { reject(new Error('boom')); });

      expect(view.result.current.ready).toBe(true);
      expect(view.result.current.errorCode).toBeNull();
    });
  });

  describe('now', () => {
    it('advances every 30 seconds while a member is signed in', async () => {
      const { result } = await mount();
      const first = result.current.now.getTime();

      await act(async () => { await vi.advanceTimersByTimeAsync(29000); });
      expect(result.current.now.getTime()).toBe(first);

      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(result.current.now.getTime()).toBe(first + 30000);

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(result.current.now.getTime()).toBe(first + 60000);
    });

    it('stops ticking on unmount', async () => {
      const { unmount } = await mount();

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
