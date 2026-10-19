import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionContext from '../../features/accounts/composition/SessionProvider';
import BackendContext from '../../shared/backend/BackendContext';
import Account from './Account';

const ok = (data = null) => ({ ok: true, data });

const SESSION = { userId: 'user-1', email: 'ana@example.test' };
const PROFILE = {
  id: 'user-1',
  fullName: 'Ana Perez',
  consentVersion: '2026-01-01',
  consentAt: '2026-10-01T10:00:00+00:00',
  isAdmin: false,
};

const SIGNED_IN = {
  status: 'signed-in', session: SESSION, profile: PROFILE, errorCode: null,
};
const SIGNED_OUT = {
  status: 'signed-out', session: null, profile: null, errorCode: null,
};

// Counts every time the login page is shown, even for an instant.
const loginVisits = vi.fn();
function LoginPage() {
  useEffect(() => { loginVisits(); }, []);
  return <p>login page</p>;
}

function fakeAuth(overrides = {}) {
  return {
    updatePassword: vi.fn(async () => ok()),
    signOutOthers: vi.fn(async () => ok()),
    deleteMyAccount: vi.fn(async () => ok()),
    ...overrides,
  };
}

// A session whose status really changes: `signOut` moves it to signed-out, the
// way the provider does, so the page meets the redirect it has to survive.
function StatefulSession({
  initial, start, signOutSpy, children,
}) {
  const [state, setState] = useState(initial);
  const value = useMemo(() => ({
    ...state,
    start,
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      signOutSpy();
      setState(SIGNED_OUT);
      // The page renders the signed-out status before the caller resumes, which
      // is the order the redirect guard has to survive.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    }),
  }), [state, start, signOutSpy]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

StatefulSession.propTypes = {
  initial: PropTypes.shape({ status: PropTypes.string.isRequired }).isRequired,
  start: PropTypes.func.isRequired,
  signOutSpy: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

function renderAccount({
  auth = fakeAuth(),
  initial = SIGNED_IN,
  start = vi.fn(async () => {}),
} = {}) {
  const signOutSpy = vi.fn();
  render(
    <MemoryRouter initialEntries={['/account']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <StatefulSession initial={initial} start={start} signOutSpy={signOutSpy}>
          <Routes>
            <Route path="/account" element={<Account />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacy" element={<p>privacy page</p>} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </StatefulSession>
      </BackendContext.Provider>
    </MemoryRouter>,
  );
  return { auth, start, signOutSpy };
}

describe('Account', () => {
  beforeEach(() => {
    loginVisits.mockClear();
  });

  it('starts the session on mount', () => {
    const { start } = renderAccount();

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('tries the start once more when it rejects, and stays quiet', async () => {
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('store unavailable'))
      .mockResolvedValueOnce(undefined);

    renderAccount({ start });

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
  });

  describe('while the session loads', () => {
    it.each(['idle', 'loading'])('shows a loading status when the status is %s', (status) => {
      renderAccount({ initial: { ...SIGNED_OUT, status } });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando tu cuenta…');
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
    });
  });

  describe('without a session', () => {
    it('sends a signed-out visitor to the login page', async () => {
      renderAccount({ initial: SIGNED_OUT });

      expect(await screen.findByText('login page')).toBeInTheDocument();
    });

    it('sends an error with no session to the login page', async () => {
      renderAccount({
        initial: {
          status: 'error', session: null, profile: null, errorCode: 'NETWORK',
        },
      });

      expect(await screen.findByText('login page')).toBeInTheDocument();
    });

    it('keeps an error that still has a session on the page, with a way to try again', async () => {
      const user = userEvent.setup();
      const { start } = renderAccount({
        initial: {
          status: 'error', session: SESSION, profile: null, errorCode: 'NETWORK',
        },
      });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta. Inténtalo de nuevo.');
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(start).toHaveBeenCalledTimes(2);
    });
  });

  describe('signed in', () => {
    it('shows the name, the email and the consent on record, with the date in Lima time', () => {
      renderAccount({
        initial: {
          ...SIGNED_IN,
          // 02:30 UTC on the 2nd is still the evening of the 1st in Lima (UTC-5).
          profile: { ...PROFILE, consentVersion: '2026-01-01', consentAt: '2026-10-02T02:30:00+00:00' },
        },
      });

      expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
      expect(screen.getByText('Ana Perez')).toBeInTheDocument();
      expect(screen.getByText('ana@example.test')).toBeInTheDocument();
      expect(screen.getByText(
        'Aceptaste el aviso de privacidad versión 2026-01-01 el 1 de octubre de 2026.',
      )).toBeInTheDocument();
    });

    it('links to the privacy notice', () => {
      renderAccount();

      expect(screen.getByRole('link', { name: 'Ver el aviso de privacidad' }))
        .toHaveAttribute('href', '/privacy');
    });

    it('leaves the consent line out when no consent is on record', () => {
      renderAccount({
        initial: { ...SIGNED_IN, profile: { ...PROFILE, consentAt: null } },
      });

      expect(screen.queryByText(/Aceptaste el aviso de privacidad/)).not.toBeInTheDocument();
    });

    it('signs this device out and goes to the home page, not to the login page', async () => {
      const user = userEvent.setup();
      const { signOutSpy } = renderAccount();

      await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      expect(await screen.findByText('home page')).toBeInTheDocument();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
      expect(loginVisits).not.toHaveBeenCalled();
    });

    it('changes the password and says so, replacing the form', async () => {
      const user = userEvent.setup();
      const { auth } = renderAccount();
      const section = screen.getByRole('region', { name: 'Cambiar contraseña' });

      await user.type(within(section).getByLabelText('Nueva contraseña'), 'abcdefg2');
      await user.type(within(section).getByLabelText('Repite la contraseña'), 'abcdefg2');
      await user.click(within(section).getByRole('button', { name: 'Cambiar contraseña' }));

      expect(await within(section).findByRole('status')).toHaveTextContent('Tu contraseña se actualizó.');
      expect(auth.updatePassword).toHaveBeenCalledWith({ password: 'abcdefg2' });
      expect(auth.signOutOthers).toHaveBeenCalledTimes(1);
      expect(within(section).queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    });
  });

  describe('deleting the account', () => {
    async function deleteAccount(user) {
      await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
      await user.click(screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' }));
    }

    it('ends on the final state, with only a link home, and stays there after the sign-out', async () => {
      const user = userEvent.setup();
      const { auth, signOutSpy } = renderAccount();

      await deleteAccount(user);

      expect(await screen.findByText('Tu cuenta fue eliminada.')).toBeInTheDocument();
      await waitFor(() => expect(signOutSpy).toHaveBeenCalledTimes(1));
      expect(auth.deleteMyAccount).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
      expect(loginVisits).not.toHaveBeenCalled();
      expect(screen.queryByText('ana@example.test')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('stays on the page with an alert when the deletion fails', async () => {
      const user = userEvent.setup();
      renderAccount({
        auth: fakeAuth({ deleteMyAccount: vi.fn(async () => ({ ok: false, code: 'NETWORK' })) }),
      });

      await deleteAccount(user);

      expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión.');
      expect(screen.queryByText('Tu cuenta fue eliminada.')).not.toBeInTheDocument();
      expect(screen.getByText('ana@example.test')).toBeInTheDocument();
    });
  });
});
