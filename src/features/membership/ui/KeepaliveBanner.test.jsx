import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

import BackendContext from '../../../shared/backend/BackendContext';
import KeepaliveBanner from './KeepaliveBanner';

const DAY = 24 * 60 * 60 * 1000;
// 10:00 on 20 October 2026 in Lima.
const NOW = new Date('2026-10-20T15:00:00Z');

const ok = (data) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });
const instantAgo = (ms) => new Date(NOW.getTime() - ms).toISOString();

const RUNS = 'Revisa el historial del flujo «Keep-alive ping» en GitHub Actions.';
const staleText = (day, days) => (
  `El último ping de mantenimiento registrado fue el ${day}, hace ${days}. ${RUNS}`
);

// A call the test settles by hand, to hold the read in flight.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

const treeOf = (services) => (
  <BackendContext.Provider value={{ enabled: true, services }}>
    <KeepaliveBanner />
  </BackendContext.Provider>
);

// The threshold comes from a build-time variable that a local env file may set,
// so every test says what it is (`undefined` is a variable that is not set).
function renderBanner(days, {
  getLastPing = vi.fn(async () => ok(null)),
  services = { membership: { getLastPing } },
  strict = false,
} = {}) {
  vi.stubEnv('VITE_KEEPALIVE_ALERT_DAYS', days);
  const view = render(strict ? <StrictMode>{treeOf(services)}</StrictMode> : treeOf(services));
  return { getLastPing, services, ...view };
}

// Lets a read that has already answered reach the screen.
const settle = () => act(async () => {});

// A ping of `hiddenAge` is not old enough for the threshold that `days` gives and
// shows nothing; one of `shownAge` is old enough, and its notice is returned.
async function noticeAtThreshold(days, hiddenAge, shownAge) {
  const hidden = renderBanner(days, { getLastPing: vi.fn(async () => ok(instantAgo(hiddenAge))) });
  await settle();
  expect(hidden.container).toBeEmptyDOMElement();
  hidden.unmount();

  renderBanner(days, { getLastPing: vi.fn(async () => ok(instantAgo(shownAge))) });
  return screen.findByRole('status');
}

describe('KeepaliveBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('when no ping is recorded', () => {
    it('shows nothing, because a project that never ran the workflow is not told apart from a new one', async () => {
      const { container, getLastPing } = renderBanner('', {
        getLastPing: vi.fn(async () => ok(null)),
      });

      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('when the last ping is too old', () => {
    it('gives the day of the ping and the days that have passed, one millisecond past the threshold', async () => {
      // 14:59:59.999 UTC on 17 October is 09:59:59.999 in Lima: still the 17th.
      renderBanner('', { getLastPing: vi.fn(async () => ok(instantAgo(3 * DAY + 1))) });

      expect(await screen.findByRole('status'))
        .toHaveTextContent(staleText('17 de octubre de 2026', '3 días'));
    });

    it('reads the instant the way the database writes it, and gives the day on the Lima calendar', async () => {
      // 03:30 UTC on 16 October is the evening of the 15th in Lima.
      renderBanner('', {
        getLastPing: vi.fn(async () => ok('2026-10-16T03:30:00.123456+00:00')),
      });

      expect(await screen.findByRole('status'))
        .toHaveTextContent(staleText('15 de octubre de 2026', '4 días'));
    });

    it('uses the singular for one day', async () => {
      renderBanner('1', { getLastPing: vi.fn(async () => ok(instantAgo(DAY + 1))) });

      expect(await screen.findByRole('status'))
        .toHaveTextContent(staleText('19 de octubre de 2026', '1 día'));
    });

    it('is a polite live region, not an alert', async () => {
      renderBanner('', { getLastPing: vi.fn(async () => ok(instantAgo(10 * DAY))) });

      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('never claims that the workflow failed', async () => {
      renderBanner('', { getLastPing: vi.fn(async () => ok(instantAgo(10 * DAY))) });

      expect((await screen.findByRole('status')).textContent).not.toMatch(/fall|error|caíd|roto/i);
    });
  });

  describe('when the last ping is recent enough', () => {
    it.each([
      ['just now', 0],
      ['a day ago', DAY],
      ['exactly the threshold ago', 3 * DAY],
      ['in the future, which only a clock that is behind explains', -5 * DAY],
    ])('shows nothing for a ping %s', async (_label, age) => {
      const { container, getLastPing } = renderBanner('', {
        getLastPing: vi.fn(async () => ok(instantAgo(age))),
      });

      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('the threshold', () => {
    it.each([
      ['not set', undefined],
      ['empty', ''],
      ['three days written out', '3'],
    ])('is three days when the variable is %s', async (_label, days) => {
      expect(await noticeAtThreshold(days, 3 * DAY, 3 * DAY + 1))
        .toHaveTextContent(staleText('17 de octubre de 2026', '3 días'));
    });

    it.each(['abc', '0', '-1', '3.5', ' 3', '03', 'offf', '9007199254740992'])(
      'counts the malformed value %j as three days, which only the dev server and the tests can meet',
      async (days) => {
        expect(await noticeAtThreshold(days, 2 * DAY, 4 * DAY))
          .toHaveTextContent(staleText('16 de octubre de 2026', '4 días'));
      },
    );

    it('is the number of days the variable holds', async () => {
      expect(await noticeAtThreshold('7', 5 * DAY, 8 * DAY))
        .toHaveTextContent(staleText('12 de octubre de 2026', '8 días'));
    });

    it.each(['off', 'OFF', 'Off'])(
      'turns the banner off for %j, without even reading the heartbeat',
      async (days) => {
        const { container, getLastPing } = renderBanner(days, {
          getLastPing: vi.fn(async () => ok(null)),
        });

        await settle();

        expect(getLastPing).not.toHaveBeenCalled();
        expect(container).toBeEmptyDOMElement();
      },
    );
  });

  describe('when the heartbeat cannot be read', () => {
    it.each(['NETWORK', 'FORBIDDEN', 'NOT_FOUND', 'INVALID', 'UNKNOWN', 'SOMETHING_ELSE'])(
      'shows nothing for a failed read with the code %s',
      async (code) => {
        const { container, getLastPing } = renderBanner('', {
          getLastPing: vi.fn(async () => fail(code, { message: 'ana@example.test' })),
        });

        await settle();

        expect(getLastPing).toHaveBeenCalledTimes(1);
        expect(container).toBeEmptyDOMElement();
      },
    );

    // Whatever else a failed answer carries, it says nothing about the heartbeat.
    it.each([
      ['an empty one', null],
      ['an old instant', instantAgo(10 * DAY)],
    ])('shows nothing for a failed read that carries data: %s', async (_label, data) => {
      const { container } = renderBanner('', {
        getLastPing: vi.fn(async () => fail('NETWORK', { data })),
      });

      await settle();

      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing for a failed read that carries no code', async () => {
      const { container, getLastPing } = renderBanner('', {
        getLastPing: vi.fn(async () => ({ ok: false })),
      });

      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      ['rejects', () => Promise.reject(new Error('boom ana@example.test'))],
      ['throws', () => { throw new Error('boom ana@example.test'); }],
      ['answers nothing', async () => undefined],
    ])('shows nothing, and does not break, when the read %s', async (_label, read) => {
      const { container, getLastPing } = renderBanner('', { getLastPing: vi.fn(read) });

      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      ['empty', ''],
      ['a word', 'yesterday'],
      ['a month that does not exist', '2026-13-01T00:00:00Z'],
      ['a number', 1760000000000],
    ])('shows nothing for an instant that is %s', async (_label, instant) => {
      const { container, getLastPing } = renderBanner('', {
        getLastPing: vi.fn(async () => ok(instant)),
      });

      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing when the services carry no membership adapter, and asks for nothing', async () => {
      const { container, getLastPing } = renderBanner('', { services: { auth: {} } });

      await settle();

      expect(getLastPing).not.toHaveBeenCalled();
      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing when there are no services at all', async () => {
      const { container } = renderBanner('', { services: null });

      await settle();

      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing when a membership adapter has no way to read the heartbeat', async () => {
      const { container } = renderBanner('', { services: { membership: {} } });

      await settle();

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('while the heartbeat is being read', () => {
    it('shows nothing until the answer arrives, and then the notice', async () => {
      const pending = deferred();
      const { container } = renderBanner('', { getLastPing: vi.fn(() => pending.promise) });

      await settle();
      expect(container).toBeEmptyDOMElement();

      await act(async () => { pending.resolve(ok(instantAgo(10 * DAY))); });

      expect(screen.getByRole('status'))
        .toHaveTextContent(staleText('10 de octubre de 2026', '10 días'));
    });

    it('reads once, however many times it is drawn again', async () => {
      const { getLastPing, services, rerender } = renderBanner('', {
        getLastPing: vi.fn(async () => ok(null)),
      });
      await settle();

      rerender(treeOf(services));
      rerender(treeOf(services));
      await settle();

      expect(getLastPing).toHaveBeenCalledTimes(1);
    });

    it('neither crashes nor warns when the answer arrives after the banner is gone', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const pending = deferred();
      const { unmount } = renderBanner('', { getLastPing: vi.fn(() => pending.promise) });

      unmount();
      await act(async () => { pending.resolve(ok(null)); });

      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    });

    it('neither crashes nor warns when the read fails after the banner is gone', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const pending = deferred();
      const { unmount } = renderBanner('', { getLastPing: vi.fn(() => pending.promise) });

      unmount();
      await act(async () => { pending.reject(new Error('boom')); });

      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    });

    // React in development mounts, unmounts and mounts again, so the first read is
    // left behind. Its answer must not reach the screen, however late it comes.
    it('ignores the answer of a read that was left behind', async () => {
      const first = deferred();
      const second = deferred();
      const getLastPing = vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { container } = renderBanner('', { getLastPing, strict: true });

      await act(async () => { second.resolve(ok(instantAgo(0))); });
      await act(async () => { first.resolve(ok(null)); });

      expect(getLastPing).toHaveBeenCalledTimes(2);
      expect(container).toBeEmptyDOMElement();
    });

    it('shows one notice, not two, where development reads twice', async () => {
      renderBanner('', {
        getLastPing: vi.fn(async () => ok(instantAgo(10 * DAY))),
        strict: true,
      });

      await settle();

      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
  });
});
