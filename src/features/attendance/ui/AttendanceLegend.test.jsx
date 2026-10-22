import { act, render, screen } from '@testing-library/react';

import SessionContext from '../../accounts/composition/SessionProvider';
import BackendContext from '../../../shared/backend/BackendContext';
import AttendanceProvider from '../composition/AttendanceProvider';
import AttendanceLegend from './AttendanceLegend';

const USER = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';

const ok = (data) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

function fakeServices({ periods = ok([{ startsOn: '2026-10-01', endsOn: '2026-10-31' }]) } = {}) {
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

async function renderLegend({ services = fakeServices(), session = member, enabled = true } = {}) {
  const view = render(
    <BackendContext.Provider value={{ enabled, services }}>
      <SessionContext.Provider value={session}>
        <AttendanceProvider>
          <AttendanceLegend />
        </AttendanceProvider>
      </SessionContext.Provider>
    </BackendContext.Provider>,
  );
  await act(async () => {});
  return view;
}

// Tuesday 2026-10-20, 10:00 in Lima.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AttendanceLegend', () => {
  describe('where the controls show', () => {
    it.each([
      ['a member with a paid period', member, fakeServices()],
      ['a member with no active membership, whose cards show the check too', member, fakeServices({ periods: ok([]) })],
      ['an administrator', admin, fakeServices({ periods: ok([]) })],
    ])('explains the two icons to %s', async (_label, session, services) => {
      await renderLegend({ session, services });

      expect(screen.getByText(/Toca/)).toHaveTextContent(
        'Toca para confirmar tu asistencia y para cancelarla.',
      );
    });

    it('draws the same two icons as the toggles, as real elements, with a name for a screen reader', async () => {
      const { container } = await renderLegend();

      const check = screen.getByRole('img', { name: 'el check' });
      const cross = screen.getByRole('img', { name: 'la equis' });
      expect(check.querySelector('svg.attendance-icon--check')).toHaveAttribute('aria-hidden', 'true');
      expect(cross.querySelector('svg.attendance-icon--cross')).toHaveAttribute('aria-hidden', 'true');
      // The legend reads in the order of the sentence: confirm first, then cancel.
      expect(check.compareDocumentPosition(cross)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(container.querySelector('[style]')).toBeNull();
    });

    it('is a plain paragraph, not a live region or an alert', async () => {
      await renderLegend();

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText(/Toca/).tagName).toBe('P');
    });
  });

  describe('where there are no controls', () => {
    it.each([
      ['a visitor', { status: 'idle', session: null, profile: null }],
      ['a signed-out member', { status: 'signed-out', session: null, profile: null }],
      ['a session that is loading', { status: 'loading', session: null, profile: null }],
    ])('says nothing to %s', async (_label, session) => {
      const { container } = await renderLegend({ session });

      expect(container).toBeEmptyDOMElement();
    });

    it('says nothing while the backend is disabled', async () => {
      const { container } = await renderLegend({ enabled: false });

      expect(container).toBeEmptyDOMElement();
    });

    it('says nothing while the periods are being read, or when they could not be read', async () => {
      const waiting = fakeServices();
      waiting.membership.listOwnPeriods.mockReturnValue(new Promise(() => {}));
      const first = await renderLegend({ services: waiting });
      expect(first.container).toBeEmptyDOMElement();
      first.unmount();

      const failed = await renderLegend({ services: fakeServices({ periods: fail('NETWORK') }) });
      expect(failed.container).toBeEmptyDOMElement();
    });
  });
});
