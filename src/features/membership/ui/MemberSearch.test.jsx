import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import BackendContext from '../../../shared/backend/BackendContext';
import { MEMBER_SEARCH_LIMIT } from '../adapters/membershipAdapter';
import MemberSearch from './MemberSearch';

const ok = (data) => ({ ok: true, data });

const member = (n, overrides = {}) => ({
  id: `id-${n}`,
  fullName: `Member ${n}`,
  email: `member${n}@example.test`,
  paidUntil: '2026-10-31',
  isActive: true,
  ...overrides,
});

const members = (count) => Array.from({ length: count }, (_, index) => member(index + 1));

// A call the test settles by hand, to hold a search in flight.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="location">{`${pathname}${search}${hash}`}</p>;
}

function tree(searchMembers, services = { membership: { searchMembers } }) {
  return (
    <MemoryRouter initialEntries={['/admin/members']}>
      <BackendContext.Provider value={{ enabled: true, services }}>
        <MemberSearch />
        <LocationProbe />
      </BackendContext.Provider>
    </MemoryRouter>
  );
}

function renderSearch(searchMembers = vi.fn(async () => ok([]))) {
  return { searchMembers, ...render(tree(searchMembers)) };
}

const input = () => screen.getByRole('searchbox', { name: 'Buscar por nombre o correo' });
const button = () => screen.getByRole('button', { name: /^(Buscar|Buscando…)$/ });
const status = () => screen.getByRole('status');
const rows = () => screen.queryAllByRole('listitem');

describe('MemberSearch', () => {
  describe('without a membership adapter', () => {
    it.each([
      ['the backend is off', { enabled: false, services: null }],
      ['the services carry none', { enabled: true, services: { auth: {} } }],
    ])('renders nothing when %s', (_, value) => {
      const { container } = render(
        <MemoryRouter>
          <BackendContext.Provider value={value}>
            <MemberSearch />
          </BackendContext.Provider>
        </MemoryRouter>,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('the form', () => {
    it('is a search with a labelled field and a button', async () => {
      renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(input()).toHaveAttribute('autocomplete', 'off');
      expect(button()).toHaveAttribute('type', 'submit');
    });

    it('does not let the browser submit it, which would put the query in the address', async () => {
      renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      expect(fireEvent.submit(screen.getByRole('search'))).toBe(false);
      await screen.findByText('Todavía no hay miembros.');
    });
  });

  describe('the first load', () => {
    it('lists the directory on mount, asking for every member', async () => {
      const { searchMembers } = renderSearch(vi.fn(async () => ok(members(2))));

      expect(await screen.findByText('Member 1')).toBeInTheDocument();
      expect(screen.getByText('Member 2')).toBeInTheDocument();
      expect(searchMembers).toHaveBeenCalledTimes(1);
      expect(searchMembers).toHaveBeenCalledWith('');
    });

    it('says it is searching, and keeps the button off, until the answer arrives', async () => {
      const pending = deferred();
      renderSearch(vi.fn(() => pending.promise));

      expect(status()).toHaveTextContent('Buscando…');
      expect(button()).toBeDisabled();
      expect(button()).toHaveTextContent('Buscando…');
      expect(rows()).toHaveLength(0);

      await act(async () => { pending.resolve(ok(members(1))); });

      expect(button()).toBeEnabled();
      expect(button()).toHaveTextContent('Buscar');
      expect(status()).toHaveTextContent('1 miembro');
    });
  });

  describe('searching', () => {
    it('asks for exactly what was typed', async () => {
      const user = userEvent.setup();
      const { searchMembers } = renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      await user.type(input(), '  Ana %_ ');
      await user.click(button());

      expect(searchMembers).toHaveBeenCalledTimes(2);
      expect(searchMembers).toHaveBeenLastCalledWith('  Ana %_ ');
    });

    it('searches when the administrator presses Enter in the field', async () => {
      const user = userEvent.setup();
      const { searchMembers } = renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      await user.type(input(), 'ana{Enter}');

      expect(searchMembers).toHaveBeenLastCalledWith('ana');
    });

    it('keeps what was typed in the field after the search', async () => {
      const user = userEvent.setup();
      renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      await user.type(input(), 'ana');
      await user.click(button());
      await screen.findByText('No encontramos miembros con esa búsqueda.');

      expect(input()).toHaveValue('ana');
    });

    it('keeps the query out of the address, the path and the query string alike', async () => {
      const user = userEvent.setup();
      renderSearch();
      await screen.findByText('Todavía no hay miembros.');

      await user.type(input(), 'ana@example.test{Enter}');
      await screen.findByText('No encontramos miembros con esa búsqueda.');

      expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/members$/);
    });

    it('shows the answer of the new search, not the old one, once it arrives', async () => {
      const user = userEvent.setup();
      const searchMembers = vi.fn()
        .mockResolvedValueOnce(ok([member(1, { fullName: 'Ana Perez' })]))
        .mockResolvedValueOnce(ok([member(2, { fullName: 'Beto Ruiz' })]));
      renderSearch(searchMembers);
      await screen.findByText('Ana Perez');

      await user.type(input(), 'beto');
      await user.click(button());

      expect(await screen.findByText('Beto Ruiz')).toBeInTheDocument();
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    });

    it('does not show the old answer while the new search is running', async () => {
      const user = userEvent.setup();
      const second = deferred();
      const searchMembers = vi.fn()
        .mockResolvedValueOnce(ok(members(2)))
        .mockReturnValueOnce(second.promise);
      renderSearch(searchMembers);
      await screen.findByText('Member 1');

      await user.type(input(), 'x');
      await user.click(button());

      expect(rows()).toHaveLength(0);
      expect(status()).toHaveTextContent('Buscando…');
      expect(button()).toBeDisabled();
      await act(async () => { second.resolve(ok([])); });
    });
  });

  describe('the answer', () => {
    it('counts the members found', async () => {
      renderSearch(vi.fn(async () => ok(members(3))));

      expect(await screen.findByText('3 miembros')).toBeInTheDocument();
      expect(rows()).toHaveLength(3);
    });

    it('links every member to the page of the member', async () => {
      renderSearch(vi.fn(async () => ok(members(2))));

      expect(await screen.findByRole('link', { name: 'Member 2' }))
        .toHaveAttribute('href', '/admin/members/id-2');
    });

    it('says the directory is empty when nothing was asked and nobody is listed', async () => {
      renderSearch(vi.fn(async () => ok([])));

      expect(await screen.findByText('Todavía no hay miembros.')).toBeInTheDocument();
      expect(screen.queryByText('No encontramos miembros con esa búsqueda.')).not.toBeInTheDocument();
      expect(screen.getByText(
        'Solo aparecen quienes aceptaron el aviso de privacidad y confirmaron su correo.',
      )).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('says nothing matched when something was asked', async () => {
      const user = userEvent.setup();
      renderSearch(vi.fn(async (text) => ok(text ? [] : members(1))));
      await screen.findByText('Member 1');

      await user.type(input(), 'zzz{Enter}');

      expect(await screen.findByText('No encontramos miembros con esa búsqueda.')).toBeInTheDocument();
      expect(screen.queryByText('Todavía no hay miembros.')).not.toBeInTheDocument();
      expect(screen.getByText(
        'Solo aparecen quienes aceptaron el aviso de privacidad y confirmaron su correo.',
      )).toBeInTheDocument();
    });

    it('treats a query of spaces as asking for everyone', async () => {
      const user = userEvent.setup();
      renderSearch(vi.fn(async (text) => ok(text ? [] : members(1))));
      await screen.findByText('Member 1');

      await user.type(input(), '   {Enter}');

      expect(await screen.findByText('Todavía no hay miembros.')).toBeInTheDocument();
    });

    it(`warns that the list is cut at the first ${MEMBER_SEARCH_LIMIT} results`, async () => {
      renderSearch(vi.fn(async () => ok(members(MEMBER_SEARCH_LIMIT))));

      expect(await screen.findByText(
        `Mostramos solo los primeros ${MEMBER_SEARCH_LIMIT} resultados. `
        + 'Escribe más del nombre o del correo para afinar la búsqueda.',
      )).toBeInTheDocument();
      expect(rows()).toHaveLength(MEMBER_SEARCH_LIMIT);
    });

    it('gives no warning when the list is one short of the limit', async () => {
      renderSearch(vi.fn(async () => ok(members(MEMBER_SEARCH_LIMIT - 1))));

      await screen.findByText(`${MEMBER_SEARCH_LIMIT - 1} miembros`);

      expect(screen.queryByText(/Mostramos solo los primeros/)).not.toBeInTheDocument();
    });
  });

  describe('when the search fails', () => {
    it.each([
      ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
      ['FORBIDDEN', 'No tienes permiso para ver a los miembros o tu sesión venció. Vuelve a ingresar.'],
      ['UNKNOWN', 'No pudimos buscar a los miembros. Inténtalo de nuevo.'],
      ['INVALID', 'No pudimos buscar a los miembros. Inténtalo de nuevo.'],
    ])('shows the fixed message of the code %s in an alert, with no list', async (code, message) => {
      renderSearch(vi.fn(async () => ({ ok: false, code })));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(status()).toBeEmptyDOMElement();
    });

    it('never shows what the backend said', async () => {
      renderSearch(vi.fn(async () => ({
        ok: false,
        code: 'UNKNOWN',
        message: 'duplicate key value violates unique constraint',
        details: 'Key (member_id)=(3b241101) overlaps ana@example.test',
      })));

      const alert = await screen.findByRole('alert');

      expect(alert).not.toHaveTextContent(/duplicate key|3b241101|ana@example/);
    });

    // A failure always says so: the alert follows the failure, not the code.
    it.each([
      ['no code at all', {}],
      ['an undefined code', { code: undefined }],
      ['a null code', { code: null }],
      ['an empty code', { code: '' }],
    ])('shows the generic message in an alert when the failed result has %s', async (_label, answer) => {
      renderSearch(vi.fn(async () => ({ ok: false, ...answer })));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos buscar a los miembros. Inténtalo de nuevo.');
      expect(button()).toBeEnabled();
    });

    it('treats a call that rejects as a failure instead of waiting for ever', async () => {
      renderSearch(vi.fn(async () => { throw new Error('boom'); }));

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos buscar a los miembros. Inténtalo de nuevo.');
      expect(button()).toBeEnabled();
    });

    it('lets the administrator search again, and the alert goes away', async () => {
      const user = userEvent.setup();
      const searchMembers = vi.fn()
        .mockResolvedValueOnce({ ok: false, code: 'NETWORK' })
        .mockResolvedValueOnce(ok(members(1)));
      renderSearch(searchMembers);
      await screen.findByRole('alert');

      await user.click(button());

      expect(await screen.findByText('Member 1')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when answers arrive out of order', () => {
    it('shows the answer of the latest search, whichever answers last', async () => {
      const first = deferred();
      const second = deferred();
      const searchMembers = vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      renderSearch(searchMembers);

      // The button is off while a search runs, but a form can still be submitted
      // (the Enter key of some browsers), and the newer query has to win.
      fireEvent.change(input(), { target: { value: 'beto' } });
      fireEvent.submit(screen.getByRole('search'));
      expect(searchMembers).toHaveBeenLastCalledWith('beto');

      await act(async () => { second.resolve(ok([member(2, { fullName: 'Beto Ruiz' })])); });
      await act(async () => { first.resolve(ok([member(1, { fullName: 'Ana Perez' })])); });

      expect(screen.getByText('Beto Ruiz')).toBeInTheDocument();
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    });

    it('keeps the answer of the second mount of a strict-mode render, whichever answers last', async () => {
      const calls = [];
      const searchMembers = vi.fn(() => {
        const call = deferred();
        calls.push(call);
        return call.promise;
      });

      render(<StrictMode>{tree(searchMembers)}</StrictMode>);
      expect(calls).toHaveLength(2);

      await act(async () => { calls[1].resolve(ok([member(2, { fullName: 'Beto Ruiz' })])); });
      await act(async () => { calls[0].resolve(ok([member(1, { fullName: 'Ana Perez' })])); });

      expect(screen.getByText('Beto Ruiz')).toBeInTheDocument();
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    });
  });
});
