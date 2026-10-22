import { act, render, screen } from '@testing-library/react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider, { TICK_MS } from '../composition/AttendanceProvider';
import InactiveMembershipNotice from './InactiveMembershipNotice';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const WHATSAPP = 'https://wa.me/51960507583';
const MESSAGE = 'Tu membresía no está activa. Matricúlate para confirmar tu asistencia a las clases.';

// Tuesday 2026-10-20, 10:00 in Lima (UTC-05:00).
const NOW = new Date('2026-10-20T15:00:00Z');

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

const OPEN_MONTH = [{ startsOn: '2026-10-01', endsOn: '2026-10-31' }];

function fakeServices({ periods = ok(OPEN_MONTH) } = {}) {
  return {
    attendance: {
      listOwnConfirmations: vi.fn(async () => ok([])),
      confirm: vi.fn(async () => ok(null)),
      cancel: vi.fn(async () => ok(null)),
    },
    membership: { listOwnPeriods: vi.fn(async () => periods) },
  };
}

const member = { status: 'signed-in', session: { userId: USER }, profile: { id: USER, isAdmin: false } };
const admin = { status: 'signed-in', session: { userId: USER }, profile: { id: USER, isAdmin: true } };

async function renderNotice({
  services = fakeServices(), session = member, enabled = true, whatsappLink = WHATSAPP,
} = {}) {
  const view = render(
    <BackendContext.Provider value={{ enabled, services }}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          <InactiveMembershipNotice whatsappLink={whatsappLink} />
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return { ...view, services };
}

describe('InactiveMembershipNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('for a member whose membership is not active today', () => {
    it.each([
      ['no paid period at all', []],
      ['periods that all ended', [{ startsOn: '2026-09-01', endsOn: '2026-10-19' }]],
      ['a period that has not started', [{ startsOn: '2026-10-21', endsOn: '2026-11-20' }]],
    ])('says so once and invites to enrol, with %s', async (_label, periods) => {
      await renderNotice({ services: fakeServices({ periods: ok(periods) }) });

      expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
      expect(screen.getByRole('status')).toHaveTextContent(MESSAGE);
    });

    it('links to WhatsApp, in a new tab', async () => {
      await renderNotice({ services: fakeServices({ periods: ok([]) }) });

      const link = screen.getByRole('link', { name: 'Escríbenos por WhatsApp' });
      expect(link).toHaveAttribute('href', WHATSAPP);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });

    it('says it alone, with no link, when the studio has no WhatsApp', async () => {
      const { container } = await renderNotice({
        services: fakeServices({ periods: ok([]) }), whatsappLink: null,
      });

      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
      expect(container.querySelector('a')).toBeNull();
    });

    it('has no button and no inline style', async () => {
      const { container } = await renderNotice({ services: fakeServices({ periods: ok([]) }) });

      expect(screen.queryByRole('button')).toBeNull();
      expect(container.querySelector('[style]')).toBeNull();
    });

    // The membership is judged on the Lima calendar, and the clock of the provider
    // moves on: a notice that was not needed at ten in the morning is needed after
    // the last day of the period has ended in Lima.
    it('appears when the last day of the period ends, in Lima time', async () => {
      const lastDay = [{ startsOn: '2026-10-01', endsOn: '2026-10-20' }];
      await renderNotice({ services: fakeServices({ periods: ok(lastDay) }) });
      expect(screen.queryByText(MESSAGE)).toBeNull();

      // 00:30 on the 21st in Lima.
      await act(async () => {
        vi.setSystemTime(new Date('2026-10-21T05:30:00Z'));
        vi.advanceTimersByTime(TICK_MS);
      });

      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    });
  });

  describe('says nothing', () => {
    it.each([
      ['a period that covers today', OPEN_MONTH],
      // The notice is about the membership today: a class after the end of a period
      // that ends today gets the message of its own card, not this one.
      ['a period that ends today', [{ startsOn: '2026-10-01', endsOn: '2026-10-20' }]],
      ['a period that starts today', [{ startsOn: '2026-10-20', endsOn: '2026-11-19' }]],
    ])('to a member who is active today, with %s', async (_label, periods) => {
      const { container } = await renderNotice({
        services: fakeServices({ periods: ok(periods) }),
      });

      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      ['no paid period at all', []],
      ['periods that all ended', [{ startsOn: '2026-08-01', endsOn: '2026-09-30' }]],
    ])('to an administrator, with %s', async (_label, periods) => {
      const { container } = await renderNotice({
        services: fakeServices({ periods: ok(periods) }), session: admin,
      });

      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      ['a visitor (idle)', { status: 'idle', session: null, profile: null }],
      ['a signed-out member', { status: 'signed-out', session: null, profile: null }],
      ['a session that is loading', { status: 'loading', session: null, profile: null }],
      ['a session in error', { status: 'error', session: null, profile: null }],
    ])('to %s, and reads nothing', async (_label, session) => {
      const { container, services } = await renderNotice({
        services: fakeServices({ periods: ok([]) }), session,
      });

      expect(container).toBeEmptyDOMElement();
      expect(services.membership.listOwnPeriods).not.toHaveBeenCalled();
    });

    it('while the backend is disabled', async () => {
      const { container } = await renderNotice({
        services: fakeServices({ periods: ok([]) }), enabled: false,
      });

      expect(container).toBeEmptyDOMElement();
    });

    it('while the periods are still being read, so nothing flashes as inactive', async () => {
      const services = fakeServices();
      services.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));

      const { container } = await renderNotice({ services });

      expect(container).toBeEmptyDOMElement();
    });

    it('when the periods could not be read: the retry notice speaks, not this one', async () => {
      const { container } = await renderNotice({
        services: fakeServices({ periods: fail('NETWORK') }),
      });

      expect(container).toBeEmptyDOMElement();
    });
  });
});
