import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BackendContext from '../../../shared/backend/BackendContext';
import SessionContext from '../composition/SessionProvider';
import {
  CURRENT_NOTICE_VERSION,
  readPendingConsentVersion,
  storePendingConsentVersion,
} from '../domain/noticeVersion';
import ConsentGate from './ConsentGate';

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: CURRENT_NOTICE_VERSION,
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};
const PENDING = {
  ...PROFILE, fullName: '', consentVersion: null, consentAt: null,
};

function fakeServices(overrides = {}) {
  return {
    auth: {
      recordConsent: vi.fn(async () => ok()),
      deleteMyAccount: vi.fn(async () => ok()),
      ...overrides,
    },
  };
}

function fakeSession(overrides = {}) {
  return {
    status: 'signed-in',
    session: { userId: 'user-1', email: 'ana@example.test' },
    profile: PENDING,
    errorCode: null,
    start: vi.fn(),
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

// `afterRefresh` is the profile the session holds once `session.refresh()` has
// run, the way the real provider reloads it after a consent is recorded. Left
// out, the refresh changes nothing.
function renderGate({
  session = fakeSession(),
  services = fakeServices(),
  enabled = true,
  path = '/schedules',
  afterRefresh = null,
} = {}) {
  const backend = { enabled, services };
  function Host() {
    const [profile, setProfile] = useState(session.profile);
    const value = useMemo(() => ({
      ...session,
      profile,
      refresh: async () => {
        await session.refresh();
        if (afterRefresh) {
          setProfile(afterRefresh);
        }
      },
    }), [profile]);
    return (
      <MemoryRouter initialEntries={[path]}>
        <BackendContext.Provider value={backend}>
          <SessionContext.Provider value={value}>
            <ConsentGate><p>page content</p></ConsentGate>
          </SessionContext.Provider>
        </BackendContext.Provider>
      </MemoryRouter>
    );
  }
  const view = render(<Host />);
  return { session, services, ...view };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('ConsentGate lets the page through', () => {
  it.each([
    ['a disabled backend', { status: 'disabled', session: null, profile: null }],
    ['an idle session', { status: 'idle', session: null, profile: null }],
    ['a load in progress', { status: 'loading', session: null, profile: null }],
    ['a visitor', { status: 'signed-out', session: null, profile: null }],
    ['a failed load', {
      status: 'error', session: null, profile: null, errorCode: 'NETWORK',
    }],
    ['a member with a recorded consent', { profile: PROFILE }],
  ])('for %s', (_name, overrides) => {
    renderGate({ session: fakeSession(overrides) });

    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('for the privacy notice, so a pending member can read it', () => {
    renderGate({ path: '/privacy' });

    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});

describe('ConsentGate with a pending profile and nothing stored', () => {
  it('replaces the page with the consent screen', () => {
    renderGate();

    expect(screen.queryByText('page content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aviso de privacidad' }))
      .toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' })).toBeEnabled();
  });

  it('moves the focus to the heading', () => {
    renderGate();

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('records the current version on accept and refreshes the session', async () => {
    const user = userEvent.setup();
    const { services, session } = renderGate();

    await user.click(screen.getByRole('button', { name: 'Acepto' }));

    expect(services.auth.recordConsent).toHaveBeenCalledWith(CURRENT_NOTICE_VERSION);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(services.auth.deleteMyAccount).not.toHaveBeenCalled();
  });

  it('deletes the account and signs out on decline', async () => {
    const user = userEvent.setup();
    const { services, session } = renderGate();

    await user.click(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' }));

    expect(services.auth.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(services.auth.recordConsent).not.toHaveBeenCalled();
  });

  it('does not sign out when the deletion failed', async () => {
    const user = userEvent.setup();
    const { session } = renderGate({
      services: fakeServices({ deleteMyAccount: vi.fn(async () => fail('NETWORK')) }),
    });

    await user.click(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' }));

    expect(session.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión');
  });

  it('disables both buttons while a call runs', async () => {
    const user = userEvent.setup();
    let release;
    const services = fakeServices({
      recordConsent: vi.fn(() => new Promise((resolve) => { release = () => resolve(ok()); })),
    });
    renderGate({ services });

    await user.click(screen.getByRole('button', { name: 'Acepto' }));

    expect(screen.getByRole('button', { name: 'Acepto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' })).toBeDisabled();
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled());
  });

  it('shows a short message without the raw error and lets the member retry', async () => {
    const user = userEvent.setup();
    const recordConsent = vi.fn()
      .mockResolvedValueOnce({ ok: false, code: 'UNKNOWN', message: 'raw failure ana@example.test' })
      .mockResolvedValueOnce(ok());
    const { session } = renderGate({ services: fakeServices({ recordConsent }) });

    await user.click(screen.getByRole('button', { name: 'Acepto' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos completar la acción');
    expect(alert).not.toHaveTextContent('raw failure');
    expect(alert).not.toHaveTextContent('ana@example.test');
    expect(session.refresh).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Acepto' }));

    expect(recordConsent).toHaveBeenCalledTimes(2);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('when a call rejects instead of returning a result', () => {
    const expectRecoverable = async () => {
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No pudimos completar la acción');
      expect(alert).not.toHaveTextContent('raw failure');
      expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' })).toBeEnabled();
    };

    it('shows the default error and enables the buttons again when accept rejects', async () => {
      const user = userEvent.setup();
      const recordConsent = vi.fn()
        .mockRejectedValueOnce(new Error('raw failure ana@example.test'))
        .mockResolvedValueOnce(ok());
      const { session } = renderGate({ services: fakeServices({ recordConsent }) });

      await user.click(screen.getByRole('button', { name: 'Acepto' }));

      await expectRecoverable();
      expect(session.refresh).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Acepto' }));

      expect(recordConsent).toHaveBeenCalledTimes(2);
      expect(session.refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the default error and enables the buttons again when decline rejects', async () => {
      const user = userEvent.setup();
      const { session } = renderGate({
        services: fakeServices({
          deleteMyAccount: vi.fn(async () => { throw new Error('raw failure'); }),
        }),
      });

      await user.click(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' }));

      await expectRecoverable();
      expect(session.signOut).not.toHaveBeenCalled();
    });

    it('does the same when the step after a successful accept rejects', async () => {
      const user = userEvent.setup();
      const refresh = vi.fn(async () => { throw new Error('raw failure'); });
      renderGate({ session: fakeSession({ refresh }) });

      await user.click(screen.getByRole('button', { name: 'Acepto' }));

      await expectRecoverable();
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('does the same when signing out after a successful decline rejects', async () => {
      const user = userEvent.setup();
      const signOut = vi.fn(async () => { throw new Error('raw failure'); });
      const { services } = renderGate({ session: fakeSession({ signOut }) });

      await user.click(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' }));

      await expectRecoverable();
      expect(services.auth.deleteMyAccount).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ConsentGate with a pending profile and a stored version', () => {
  it('records the stored version by itself, clears it and refreshes', async () => {
    storePendingConsentVersion('2026-01-01');
    const { services, session } = renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('Guardando tu consentimiento');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(1));

    expect(services.auth.recordConsent).toHaveBeenCalledTimes(1);
    expect(services.auth.recordConsent).toHaveBeenCalledWith('2026-01-01');
    expect(readPendingConsentVersion()).toBeNull();
  });

  it('records a stored version that differs from the current one as it was accepted', async () => {
    storePendingConsentVersion('2025-06-30');
    const { services } = renderGate();

    await waitFor(() => expect(services.auth.recordConsent).toHaveBeenCalledWith('2025-06-30'));
  });

  it('falls back to the consent screen when recording the stored version fails', async () => {
    storePendingConsentVersion('2099-01-01');
    const { session } = renderGate({
      services: fakeServices({ recordConsent: vi.fn(async () => fail('INVALID')) }),
    });

    expect(await screen.findByRole('heading', { name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(session.refresh).not.toHaveBeenCalled();
  });

  it('keeps the result code of a failed automatic recording and shows its message', async () => {
    storePendingConsentVersion('2026-01-01');
    renderGate({
      services: fakeServices({ recordConsent: vi.fn(async () => fail('NETWORK')) }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión');
    expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
  });

  it('shows the default error for a failed automatic recording without a message of its own', async () => {
    storePendingConsentVersion('2099-01-01');
    renderGate({
      services: fakeServices({ recordConsent: vi.fn(async () => fail('INVALID')) }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar la acción');
  });

  it('falls back to the screen with the default error when the automatic recording rejects', async () => {
    storePendingConsentVersion('2026-01-01');
    const { session } = renderGate({
      services: fakeServices({
        recordConsent: vi.fn(async () => { throw new TypeError('raw failure'); }),
      }),
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos completar la acción');
    expect(alert).not.toHaveTextContent('raw failure');
    expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(session.refresh).not.toHaveBeenCalled();
  });

  it('falls back to the screen with the default error when the refresh rejects', async () => {
    storePendingConsentVersion('2026-01-01');
    const refresh = vi.fn(async () => { throw new Error('raw failure'); });
    renderGate({ session: fakeSession({ refresh }) });

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar la acción');
    expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lets the page through once the refresh shows the recorded consent', async () => {
    storePendingConsentVersion(CURRENT_NOTICE_VERSION);
    renderGate({ afterRefresh: PROFILE });

    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('gives the member the buttons when the refreshed profile is still pending', async () => {
    storePendingConsentVersion(CURRENT_NOTICE_VERSION);
    const { services, session } = renderGate();

    expect(await screen.findByRole('button', { name: 'Acepto' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'No acepto, eliminar mi cuenta' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(services.auth.recordConsent).toHaveBeenCalledTimes(1);
    expect(session.refresh).toHaveBeenCalledTimes(1);
  });

  it('asks again, naming the update, when the stored version is older than the current one', async () => {
    storePendingConsentVersion('2025-06-30');
    const { services } = renderGate({
      afterRefresh: { ...PROFILE, consentVersion: '2025-06-30' },
    });

    expect(await screen.findByRole('heading', { name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(screen.getByText(/Actualizamos el aviso de privacidad/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acepto' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(services.auth.recordConsent).toHaveBeenCalledTimes(1);
  });
});

describe('ConsentGate when the recorded notice is outdated', () => {
  const outdated = { profile: { ...PROFILE, consentVersion: '2025-01-01' } };

  it('asks again, naming the update, and ignores any stored version', () => {
    storePendingConsentVersion('2026-01-01');
    const { services } = renderGate({ session: fakeSession(outdated) });

    expect(screen.getByRole('heading', { name: 'Necesitamos tu consentimiento' }))
      .toBeInTheDocument();
    expect(screen.getByText(/Actualizamos el aviso de privacidad/)).toBeInTheDocument();
    expect(services.auth.recordConsent).not.toHaveBeenCalled();
  });

  it('records the current version on accept', async () => {
    const user = userEvent.setup();
    const { services } = renderGate({ session: fakeSession(outdated) });

    await user.click(screen.getByRole('button', { name: 'Acepto' }));

    expect(services.auth.recordConsent).toHaveBeenCalledWith(CURRENT_NOTICE_VERSION);
  });
});
