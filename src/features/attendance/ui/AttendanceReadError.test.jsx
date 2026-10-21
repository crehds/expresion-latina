import {
  act, fireEvent, render, screen,
} from '@testing-library/react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider, { useAttendance } from '../composition/AttendanceProvider';
import AttendanceReadError from './AttendanceReadError';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const NOW = new Date('2026-10-20T15:00:00Z');
const OCCURRENCE = {
  classDate: '2026-10-26',
  startTime: '19:00',
  endTime: '20:00',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
};

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

function fakeServices({ periods = ok([]), confirmations = ok([]) } = {}) {
  return {
    attendance: {
      listOwnConfirmations: vi.fn(async () => confirmations),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: { listOwnPeriods: vi.fn(async () => periods) },
  };
}

const SIGNED_IN = { status: 'signed-in', session: { userId: USER }, profile: { id: USER } };

// A stand-in for a card: it can fail an action, which is not a read failure.
function ActionButton() {
  const { confirm } = useAttendance();
  return <button type="button" onClick={() => confirm(OCCURRENCE)}>act</button>;
}

async function renderNotice({
  services = fakeServices(),
  session = SIGNED_IN,
  enabled = true,
} = {}) {
  const view = render(
    <BackendContext.Provider value={{ enabled, services }}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          <div data-testid="notice"><AttendanceReadError /></div>
          <ActionButton />
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return { ...view, services };
}

const notice = () => screen.getByTestId('notice');

describe('AttendanceReadError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('renders nothing', () => {
    it.each([
      ['disabled', { status: 'disabled', session: null, profile: null }],
      ['idle', { status: 'idle', session: null, profile: null }],
      ['loading', { status: 'loading', session: null, profile: null }],
      ['signed-out', { status: 'signed-out', session: null, profile: null }],
      ['error', { status: 'error', session: null, profile: null }],
    ])('while the session is %s', async (_label, session) => {
      await renderNotice({ session });

      expect(notice()).toBeEmptyDOMElement();
    });

    it('while the backend is disabled', async () => {
      await renderNotice({ enabled: false });

      expect(notice()).toBeEmptyDOMElement();
    });

    it('when the data is ready', async () => {
      await renderNotice();

      expect(notice()).toBeEmptyDOMElement();
    });

    it('when an action failed while the data was not ready, which is not a read failure', async () => {
      const services = fakeServices();
      services.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));
      services.attendance.confirm.mockResolvedValue(fail('NETWORK'));
      await renderNotice({ services });

      fireEvent.click(screen.getByRole('button', { name: 'act' }));
      await act(async () => {});

      expect(services.attendance.confirm).toHaveBeenCalledTimes(1);
      expect(notice()).toBeEmptyDOMElement();
    });

    it('while the data is still loading', async () => {
      const services = fakeServices();
      services.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));

      await renderNotice({ services });

      expect(notice()).toBeEmptyDOMElement();
    });
  });

  describe('when the first read fails', () => {
    it('says so as an alert, with a retry button', async () => {
      await renderNotice({ services: fakeServices({ periods: fail('NETWORK') }) });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tu asistencia.');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    });

    it('also when only the confirmations read fails', async () => {
      await renderNotice({ services: fakeServices({ confirmations: fail('UNKNOWN') }) });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('reads again on a click, and goes away when the read works', async () => {
      const services = fakeServices({ periods: fail('NETWORK') });
      await renderNotice({ services });
      services.membership.listOwnPeriods.mockResolvedValue(ok([]));

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await act(async () => {});

      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(2);
      expect(notice()).toBeEmptyDOMElement();
    });

    it('stays, enabled again, when the retry fails too', async () => {
      const services = fakeServices({ periods: fail('NETWORK') });
      await renderNotice({ services });

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await act(async () => {});

      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    });

    it('is disabled, and still shown, while its own retry is pending', async () => {
      const services = fakeServices({ periods: fail('NETWORK') });
      await renderNotice({ services });
      let release;
      services.membership.listOwnPeriods.mockReturnValue(
        new Promise((resolve) => { release = resolve; }),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await act(async () => {});

      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(services.membership.listOwnPeriods).toHaveBeenCalledTimes(2);

      await act(async () => { release(ok([])); });

      expect(notice()).toBeEmptyDOMElement();
    });

    it('does not touch its state when it unmounts while the retry is pending', async () => {
      const services = fakeServices({ periods: fail('NETWORK') });
      const { unmount } = await renderNotice({ services });
      let release;
      services.membership.listOwnPeriods.mockReturnValue(
        new Promise((resolve) => { release = resolve; }),
      );
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await act(async () => {});
      unmount();
      await act(async () => { release(ok([])); });

      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  });
});
