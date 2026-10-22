import {
  act, render, screen, waitFor, within,
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
  initial, start, signOutSpy, signOutImpl = undefined, exposeSetState, children,
}) {
  const [state, setState] = useState(initial);
  useEffect(() => { exposeSetState(setState); }, [exposeSetState]);
  const value = useMemo(() => ({
    ...state,
    start,
    refresh: vi.fn(async () => {}),
    signOut: signOutImpl ?? vi.fn(async () => {
      signOutSpy();
      setState(SIGNED_OUT);
      // The page renders the signed-out status before the caller resumes, which
      // is the order the redirect guard has to survive.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      return ok();
    }),
  }), [state, start, signOutSpy, signOutImpl]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

StatefulSession.propTypes = {
  initial: PropTypes.shape({ status: PropTypes.string.isRequired }).isRequired,
  start: PropTypes.func.isRequired,
  signOutSpy: PropTypes.func.isRequired,
  signOutImpl: PropTypes.func,
  exposeSetState: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

function renderAccount({
  auth = fakeAuth(),
  initial = SIGNED_IN,
  start = vi.fn(async () => {}),
  signOutImpl,
} = {}) {
  const signOutSpy = vi.fn();
  const handle = { setState: null };
  render(
    <MemoryRouter initialEntries={['/account']}>
      <BackendContext.Provider value={{ enabled: true, services: { auth } }}>
        <StatefulSession
          initial={initial}
          start={start}
          signOutSpy={signOutSpy}
          signOutImpl={signOutImpl}
          exposeSetState={(setState) => { handle.setState = setState; }}
        >
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
  return {
    auth, start, signOutSpy, handle,
  };
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

  describe('retrying the load', () => {
    it('goes through the shared start helper, so a rejected start stays quiet', async () => {
      const user = userEvent.setup();
      const start = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('store unavailable'));
      renderAccount({
        start,
        initial: {
          status: 'error', session: SESSION, profile: null, errorCode: 'NETWORK',
        },
      });

      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      // One call on mount, then the click and the helper's own second attempt.
      await waitFor(() => expect(start).toHaveBeenCalledTimes(3));
      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tu cuenta.');
    });
  });

  // The page is three cards: the data of the member (with the sign-out), the
  // password and, last and wide because it is the destructive one, the deletion.
  // The stylesheet lays them out (one column on a phone, two from 768px), so the
  // order of the document is the order they are read and tabbed in.
  describe('layout', () => {
    const regions = () => screen.getAllByRole('region');

    it('has the three sections in this order, each with its own level 2 heading', () => {
      renderAccount();

      expect(regions().map((region) => within(region).getByRole('heading', { level: 2 }).textContent))
        .toEqual(['Mis datos', 'Cambiar contraseña', 'Eliminar mi cuenta']);
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('makes each section a card, and the deletion the only wide one', () => {
      renderAccount();

      regions().forEach((region) => expect(region).toHaveClass('account__card'));
      expect(regions().map((region) => region.classList.contains('account__card--wide')))
        .toEqual([false, false, true]);
    });

    it('keeps the privacy link and the sign-out button together, in one row of actions', () => {
      renderAccount();

      const link = screen.getByRole('link', { name: 'Ver el aviso de privacidad' });
      const signOut = screen.getByRole('button', { name: 'Cerrar sesión' });

      expect(link.parentElement).toBe(signOut.parentElement);
      expect(link.parentElement).toHaveClass('account__actions');
      expect(regions()[0]).toContainElement(link);
    });

    it('tabs through the page in the order it is read', async () => {
      const user = userEvent.setup();
      renderAccount();
      // The fields are told by their name, the buttons and the link by their text.
      const nameOf = (element) => element.name || element.textContent;

      const visited = [];
      for (let step = 0; step < 6; step += 1) {
        // eslint-disable-next-line no-await-in-loop
        await user.tab();
        visited.push(nameOf(document.activeElement));
      }

      expect(visited).toEqual([
        'Ver el aviso de privacidad',
        'Cerrar sesión',
        'new-password',
        'password-confirmation',
        'Cambiar contraseña',
        'Eliminar mi cuenta',
      ]);
    });

    it('has no style attribute, because the CSP allows none', () => {
      renderAccount();

      expect(document.querySelector('[style]')).toBeNull();
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

    // The provider's signOut resolves to a result and never throws. A failure means
    // a session may still be held on this device, and the status does not change.
    describe('when signing out fails', () => {
      const failed = (code = 'NETWORK', extra = {}) => ({ ok: false, code, ...extra });
      const STILL_OPEN = 'No pudimos cerrar tu sesión: sigue abierta en este dispositivo. Inténtalo de nuevo.';

      it('says the session is still open, stays on the page and lets the member try again', async () => {
        const user = userEvent.setup();
        const signOutImpl = vi.fn().mockResolvedValue(failed());
        renderAccount({ signOutImpl });

        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(STILL_OPEN);
        expect(screen.getByText('ana@example.test')).toBeInTheDocument();
        expect(screen.queryByText('home page')).not.toBeInTheDocument();
        expect(screen.queryByText(/No pudimos cargar tu cuenta/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        expect(signOutImpl).toHaveBeenCalledTimes(2);
      });

      it.each(['NETWORK', 'FORBIDDEN', 'UNKNOWN'])(
        'says the same for %s, and never what the backend said',
        async (code) => {
          const user = userEvent.setup();
          renderAccount({
            signOutImpl: vi.fn().mockResolvedValue(failed(code, { message: 'private detail' })),
          });

          await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

          const alert = await screen.findByRole('alert');
          expect(alert).toHaveTextContent(STILL_OPEN);
          expect(document.body).not.toHaveTextContent('private detail');
        },
      );

      it('goes to the home page when the next try works, with the alert gone', async () => {
        const user = userEvent.setup();
        const signOutImpl = vi.fn()
          .mockResolvedValueOnce(failed())
          .mockResolvedValueOnce(ok());
        renderAccount({ signOutImpl });
        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await screen.findByRole('alert');

        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(await screen.findByText('home page')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(loginVisits).not.toHaveBeenCalled();
        expect(signOutImpl).toHaveBeenCalledTimes(2);
      });

      it('takes the alert away while the next try runs, and puts it back if that fails too', async () => {
        const user = userEvent.setup();
        let finish;
        const signOutImpl = vi.fn()
          .mockResolvedValueOnce(failed())
          .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
        renderAccount({ signOutImpl });
        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await screen.findByRole('alert');

        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDisabled();
        await act(async () => { finish(failed()); });
        expect(await screen.findByRole('alert')).toHaveTextContent(STILL_OPEN);
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
      });

      it('takes a sign-out that rejects for a failure too, though the provider does not', async () => {
        const user = userEvent.setup();
        const signOutImpl = vi.fn().mockRejectedValue(new Error('offline'));
        renderAccount({ signOutImpl });

        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(STILL_OPEN);
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
      });

      it('sends the member to the login page if the session ends later on', async () => {
        const user = userEvent.setup();
        const { handle } = renderAccount({
          signOutImpl: vi.fn().mockResolvedValue(failed()),
        });

        await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await screen.findByRole('alert');
        act(() => handle.setState(SIGNED_OUT));

        expect(await screen.findByText('login page')).toBeInTheDocument();
        expect(screen.queryByText('Cargando tu cuenta…')).not.toBeInTheDocument();
      });

      it('calls signOut once on a double click and disables the button meanwhile', async () => {
        const user = userEvent.setup();
        let finish;
        const signOutImpl = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
        renderAccount({ signOutImpl });
        const button = screen.getByRole('button', { name: 'Cerrar sesión' });

        await user.dblClick(button);

        expect(signOutImpl).toHaveBeenCalledTimes(1);
        expect(button).toBeDisabled();
        await act(async () => { finish(ok()); });
      });
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
