import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BackendContext from '../../../shared/backend/BackendContext';
import MemberPeriods from './MemberPeriods';

// 10:00 on 20 October 2026 in Lima: the day a new payment starts from.
const NOW = new Date('2026-10-20T15:00:00Z');

const ok = () => ({ ok: true, data: null });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

// A call the test settles by hand, to hold it in flight.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const NOVEMBER = {
  id: 'p-2', memberId: 'm-1', startsOn: '2026-11-01', endsOn: '2026-11-30',
};
const OCTOBER = {
  id: 'p-1', memberId: 'm-1', startsOn: '2026-10-01', endsOn: '2026-10-31',
};
// Newest first, the way the adapter lists them.
const PERIODS = [NOVEMBER, OCTOBER];

const NOVEMBER_TEXT = 'Del 1 de noviembre de 2026 al 30 de noviembre de 2026';
const OCTOBER_TEXT = 'Del 1 de octubre de 2026 al 31 de octubre de 2026';

function fakeMembership(overrides = {}) {
  return {
    createPeriod: vi.fn(async () => ok()),
    updatePeriod: vi.fn(async () => ok()),
    deletePeriod: vi.fn(async () => ok()),
    ...overrides,
  };
}

function tree({
  periods, reload, services,
}) {
  return (
    <BackendContext.Provider value={{ enabled: true, services }}>
      <MemberPeriods memberId="m-1" periods={periods} reload={reload} />
    </BackendContext.Provider>
  );
}

function renderPeriods({
  periods = PERIODS,
  membership = fakeMembership(),
  reload = vi.fn(async () => {}),
  services = { membership },
} = {}) {
  const view = render(tree({ periods, reload, services }));
  return {
    membership,
    reload,
    container: view.container,
    // What the page does when it has read the member again.
    showPeriods: (next) => view.rerender(tree({ periods: next, reload, services })),
  };
}

const rows = () => screen.getAllByRole('listitem');
const rowOf = (text) => within(screen.getByText(text).closest('li'));
const addButton = () => screen.getByRole('button', { name: 'Registrar pago' });
const startsOn = () => screen.getByLabelText('Fecha de inicio');
const endsOn = () => screen.getByLabelText('Fecha de fin');
const setDate = (field, value) => fireEvent.change(field, { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Guardar' });
const editButton = (text) => rowOf(text).getByRole('button', { name: `Editar el pago: ${text}` });
const deleteButton = (text) => rowOf(text).getByRole('button', { name: `Eliminar el pago: ${text}` });
const confirmDelete = () => screen.getByRole('button', { name: 'Sí, eliminar el pago' });
// The question before a delete is a group named by its words; a form has groups too.
const QUESTION = '¿Eliminar este pago? Esta acción no se puede deshacer.';
const question = () => screen.getByRole('group', { name: QUESTION });
const queryQuestion = () => screen.queryByRole('group', { name: QUESTION });

describe('MemberPeriods', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('without a membership adapter', () => {
    it.each([
      ['the services carry none', { auth: {} }],
      ['there are no services', null],
    ])('renders nothing when %s', (_, services) => {
      const { container } = renderPeriods({ services });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('the list', () => {
    it('is a section named by its heading, with the button to record a payment', () => {
      renderPeriods();

      const section = screen.getByRole('region', { name: 'Pagos registrados' });
      expect(within(section).getByRole('heading', { level: 3, name: 'Pagos registrados' }))
        .toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
    });

    it('lists the payments in the order given, newest first, each with the days it covers', () => {
      renderPeriods();

      expect(rows()).toHaveLength(2);
      expect(within(rows()[0]).getByText(NOVEMBER_TEXT)).toBeInTheDocument();
      expect(within(rows()[1]).getByText(OCTOBER_TEXT)).toBeInTheDocument();
    });

    it('gives each payment its own buttons, named after the dates they act on', () => {
      renderPeriods();

      expect(editButton(NOVEMBER_TEXT)).toHaveTextContent('Editar');
      expect(deleteButton(NOVEMBER_TEXT)).toHaveTextContent('Eliminar');
      expect(editButton(OCTOBER_TEXT)).toHaveTextContent('Editar');
      expect(deleteButton(OCTOBER_TEXT)).toHaveTextContent('Eliminar');
    });

    it('says so when the member has no payment, and still offers to record one', () => {
      renderPeriods({ periods: [] });

      expect(screen.getByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(addButton()).toBeInTheDocument();
    });

    it('shows nothing of a payment but its dates', () => {
      renderPeriods();

      expect(document.body).not.toHaveTextContent(/p-1|p-2|m-1/);
    });

    it('keeps every row, and writes a neutral line for the one whose dates are no calendar days', () => {
      renderPeriods({
        periods: [
          NOVEMBER,
          {
            id: 'p-3', memberId: 'm-1', startsOn: 'zzz-not-a-date', endsOn: '2026-10-31',
          },
          OCTOBER,
        ],
      });

      expect(rows()).toHaveLength(3);
      expect(within(rows()[0]).getByText(NOVEMBER_TEXT)).toBeInTheDocument();
      expect(within(rows()[1]).getByText('Fechas del pago no disponibles')).toBeInTheDocument();
      expect(within(rows()[2]).getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(/zzz-not-a-date/)).not.toBeInTheDocument();
    });
  });

  describe('recording a payment', () => {
    it('opens the form above the list, starting after the latest payment that has not ended', () => {
      renderPeriods();

      fireEvent.click(addButton());

      expect(screen.getByRole('form', { name: 'Registrar pago' })).toBeInTheDocument();
      expect(startsOn()).toHaveValue('2026-12-01');
      expect(endsOn()).toHaveValue('');
      expect(rows()).toHaveLength(2);
    });

    it('takes the button away while the form is open, and the form takes the focus', () => {
      renderPeriods();

      fireEvent.click(addButton());

      expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
      expect(startsOn()).toHaveFocus();
    });

    it('records the payment for this member, with exactly the two dates', async () => {
      const { membership } = renderPeriods();
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.createPeriod).toHaveBeenCalledTimes(1);
      expect(membership.createPeriod).toHaveBeenCalledWith({
        memberId: 'm-1', startsOn: '2026-12-01', endsOn: '2026-12-31',
      });
    });

    it('reads the member again after it worked, then closes the form and gives the focus back', async () => {
      const calls = [];
      const membership = fakeMembership({
        createPeriod: vi.fn(async () => { calls.push('create'); return ok(); }),
      });
      const reload = vi.fn(async () => { calls.push('reload'); });
      renderPeriods({ membership, reload });
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(calls).toEqual(['create', 'reload']);
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(addButton()).toHaveFocus();
    });

    it('keeps the form, off, until the member has been read again', async () => {
      const pending = deferred();
      renderPeriods({ reload: vi.fn(() => pending.promise) });
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();

      await act(async () => { pending.resolve(); });

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('closes the form after a payment that worked even if reading the member again throws', async () => {
      renderPeriods({ reload: vi.fn(async () => { throw new Error('boom'); }) });
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('reads the member again when the dates overlap, and keeps the form with its message', async () => {
      const membership = fakeMembership({ createPeriod: vi.fn(async () => fail('OVERLAP')) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Esas fechas se cruzan con otro pago de este miembro. Cambia las fechas e inténtalo de nuevo.',
      );
      expect(endsOn()).toHaveValue('2026-12-31');
    });

    it.each(['INVALID', 'FORBIDDEN', 'NETWORK', 'UNKNOWN'])(
      'keeps the form with the message of %s, and does not read the member again',
      async (code) => {
        const membership = fakeMembership({ createPeriod: vi.fn(async () => fail(code)) });
        const { reload } = renderPeriods({ membership });
        fireEvent.click(addButton());
        setDate(endsOn(), '2026-12-31');

        await act(async () => { fireEvent.click(saveButton()); });

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByRole('form')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
    );

    it('does not call the backend for dates the form refuses', () => {
      const { membership } = renderPeriods();
      fireEvent.click(addButton());

      fireEvent.click(saveButton());

      expect(membership.createPeriod).not.toHaveBeenCalled();
      expect(screen.getByText('Indica la fecha de fin.')).toBeInTheDocument();
    });

    it('closes the form on cancel, calling nothing, and gives the focus back', () => {
      const { membership, reload } = renderPeriods();
      fireEvent.click(addButton());

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(addButton()).toHaveFocus();
      expect(membership.createPeriod).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('starts today for a member with no payment', () => {
      renderPeriods({ periods: [] });

      fireEvent.click(addButton());

      expect(startsOn()).toHaveValue('2026-10-20');
    });

    it('does not close another form that the administrator opened while the payment was saving', async () => {
      const pending = deferred();
      const membership = fakeMembership({ createPeriod: vi.fn(() => pending.promise) });
      renderPeriods({ membership });
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');
      await act(async () => { fireEvent.click(saveButton()); });

      fireEvent.click(editButton(OCTOBER_TEXT));
      await act(async () => { pending.resolve(ok()); });

      expect(screen.getAllByRole('form')).toHaveLength(1);
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
    });

    it('shows the payments the page brings once it has read the member again', async () => {
      const added = {
        id: 'p-3', memberId: 'm-1', startsOn: '2026-12-01', endsOn: '2026-12-31',
      };
      const showing = { showPeriods: null };
      const reload = vi.fn(async () => { showing.showPeriods([added, ...PERIODS]); });
      showing.showPeriods = renderPeriods({ reload }).showPeriods;
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(rows()).toHaveLength(3);
      expect(within(rows()[0]).getByText('Del 1 de diciembre de 2026 al 31 de diciembre de 2026'))
        .toBeInTheDocument();
    });
  });

  describe('correcting a payment', () => {
    it('opens the form in the place of that payment, with its dates', () => {
      renderPeriods();

      fireEvent.click(editButton(OCTOBER_TEXT));

      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
      expect(startsOn()).toHaveValue('2026-10-01');
      expect(endsOn()).toHaveValue('2026-10-31');
      expect(within(rows()[1]).getByRole('form')).toBeInTheDocument();
      expect(within(rows()[0]).getByText(NOVEMBER_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(OCTOBER_TEXT)).not.toBeInTheDocument();
    });

    it('sends the corrected dates for that payment, and reads the member again', async () => {
      const { membership, reload } = renderPeriods();
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.updatePeriod).toHaveBeenCalledTimes(1);
      expect(membership.updatePeriod).toHaveBeenCalledWith('p-1', {
        startsOn: '2026-10-01', endsOn: '2026-10-15',
      });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(editButton(OCTOBER_TEXT)).toHaveFocus();
    });

    it('keeps one form open at a time: editing another payment closes the first form', () => {
      renderPeriods();
      fireEvent.click(editButton(OCTOBER_TEXT));

      fireEvent.click(editButton(NOVEMBER_TEXT));

      expect(screen.getAllByRole('form')).toHaveLength(1);
      expect(within(rows()[0]).getByRole('form')).toBeInTheDocument();
      expect(within(rows()[1]).getByText(OCTOBER_TEXT)).toBeInTheDocument();
    });

    it('keeps one form open at a time: recording closes a correction, and the other way round', () => {
      renderPeriods();
      fireEvent.click(editButton(OCTOBER_TEXT));

      fireEvent.click(addButton());
      expect(screen.getAllByRole('form')).toHaveLength(1);
      expect(screen.getByRole('form', { name: 'Registrar pago' })).toBeInTheDocument();

      fireEvent.click(editButton(NOVEMBER_TEXT));
      expect(screen.getAllByRole('form')).toHaveLength(1);
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
      expect(addButton()).toBeInTheDocument();
    });

    it('reads the member again when the dates overlap, and keeps the form with its message', async () => {
      const membership = fakeMembership({ updatePeriod: vi.fn(async () => fail('OVERLAP')) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-11-15');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
      expect(endsOn()).toHaveValue('2026-11-15');
      expect(screen.getByRole('alert')).toHaveTextContent('Esas fechas se cruzan con otro pago');
    });

    it('reads the member again when the payment is gone, closes the form and says so', async () => {
      const membership = fakeMembership({ updatePeriod: vi.fn(async () => fail('NOT_FOUND')) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Este pago ya no existe. Mostramos la lista al día.');
    });

    it.each(['INVALID', 'FORBIDDEN', 'NETWORK', 'UNKNOWN'])(
      'keeps the form with the message of %s, and does not read the member again',
      async (code) => {
        const membership = fakeMembership({ updatePeriod: vi.fn(async () => fail(code)) });
        const { reload } = renderPeriods({ membership });
        fireEvent.click(editButton(OCTOBER_TEXT));
        setDate(endsOn(), '2026-10-15');

        await act(async () => { fireEvent.click(saveButton()); });

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
    );

    it('keeps the form with the generic message, and reads nothing again, when the failed result has no code', async () => {
      const membership = fakeMembership({ updatePeriod: vi.fn(async () => ({ ok: false })) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(reload).not.toHaveBeenCalled();
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
      expect(screen.getByRole('alert'))
        .toHaveTextContent('No pudimos guardar el pago. Inténtalo de nuevo.');
    });

    it('closes the form on cancel, leaves the payment as it was, and gives the focus back', () => {
      const { membership } = renderPeriods();
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(editButton(OCTOBER_TEXT)).toHaveFocus();
      expect(membership.updatePeriod).not.toHaveBeenCalled();
    });

    it('takes the message about a payment that was gone away once something else is opened', async () => {
      const membership = fakeMembership({ updatePeriod: vi.fn(async () => fail('NOT_FOUND')) });
      renderPeriods({ membership });
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');
      await act(async () => { fireEvent.click(saveButton()); });
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.click(addButton());

      expect(screen.queryByText('Este pago ya no existe. Mostramos la lista al día.'))
        .not.toBeInTheDocument();
    });
  });

  describe('deleting a payment', () => {
    it('asks first, in the place of that payment buttons, and takes the focus', () => {
      const { membership } = renderPeriods();

      fireEvent.click(deleteButton(OCTOBER_TEXT));

      const group = question();
      expect(within(rows()[1]).getByRole('group', { name: QUESTION })).toBe(group);
      expect(group).toHaveFocus();
      expect(confirmDelete()).toBeEnabled();
      expect(within(group).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      expect(membership.deletePeriod).not.toHaveBeenCalled();
      expect(within(rows()[1]).queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    });

    it('cancels without calling anything, and gives the focus back to the button', () => {
      const { membership, reload } = renderPeriods();
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(queryQuestion()).not.toBeInTheDocument();
      expect(deleteButton(OCTOBER_TEXT)).toHaveFocus();
      expect(membership.deletePeriod).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('deletes the payment that was asked about, and reads the member again', async () => {
      const calls = [];
      const membership = fakeMembership({
        deletePeriod: vi.fn(async () => { calls.push('delete'); return ok(); }),
      });
      const reload = vi.fn(async () => { calls.push('reload'); });
      renderPeriods({ membership, reload });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(membership.deletePeriod).toHaveBeenCalledTimes(1);
      expect(membership.deletePeriod).toHaveBeenCalledWith('p-1');
      expect(calls).toEqual(['delete', 'reload']);
      expect(queryQuestion()).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps both buttons off while the delete is on its way, and sends it once', async () => {
      const pending = deferred();
      const membership = fakeMembership({ deletePeriod: vi.fn(() => pending.promise) });
      renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      // Both presses arrive before React has drawn the disabled button.
      act(() => {
        confirmDelete().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        confirmDelete().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(confirmDelete()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      expect(membership.deletePeriod).toHaveBeenCalledTimes(1);

      await act(async () => { pending.resolve(ok()); });
    });

    it('says it could not delete, keeps the question, and lets the administrator try again', async () => {
      const membership = fakeMembership({
        deletePeriod: vi.fn().mockResolvedValueOnce(fail('NETWORK')).mockResolvedValueOnce(ok()),
      });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(screen.getByRole('alert'))
        .toHaveTextContent('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
      expect(question()).toBeInTheDocument();
      expect(confirmDelete()).toBeEnabled();
      expect(reload).not.toHaveBeenCalled();

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(queryQuestion()).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['FORBIDDEN', 'No tienes permiso para eliminar este pago o tu sesión venció. Vuelve a ingresar.'],
      ['UNKNOWN', 'No pudimos eliminar el pago. Inténtalo de nuevo.'],
      ['INVALID', 'No pudimos eliminar el pago. Inténtalo de nuevo.'],
    ])('shows the fixed message of %s, never what the backend said', async (code, message) => {
      const membership = fakeMembership({
        deletePeriod: vi.fn(async () => fail(code, { message: 'ana@example.test', details: 'Key (id)=(p-1)' })),
      });
      renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(document.body).not.toHaveTextContent(/ana@example|Key \(id\)/);
    });

    // A failure always says so, whatever the answer carries (the form of a payment
    // has the same rule): the adapter always sets a code, but the question must not
    // depend on it.
    it.each([
      ['no code at all', {}],
      ['an undefined code', { code: undefined }],
      ['a null code', { code: null }],
      ['an empty code', { code: '' }],
    ])('shows the generic alert and frees the buttons when the failed result has %s', async (_label, answer) => {
      const membership = fakeMembership({
        deletePeriod: vi.fn(async () => ({ ok: false, ...answer })),
      });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(screen.getByRole('alert'))
        .toHaveTextContent('No pudimos eliminar el pago. Inténtalo de nuevo.');
      expect(question()).toBeInTheDocument();
      expect(confirmDelete()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('takes a delete that threw for an unknown failure and frees the buttons', async () => {
      const membership = fakeMembership({
        deletePeriod: vi.fn(async () => { throw new Error('boom'); }),
      });
      renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(screen.getByRole('alert'))
        .toHaveTextContent('No pudimos eliminar el pago. Inténtalo de nuevo.');
      expect(confirmDelete()).toBeEnabled();
    });

    it('reads the member again when the payment is already gone, and says so', async () => {
      const membership = fakeMembership({ deletePeriod: vi.fn(async () => fail('NOT_FOUND')) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(queryQuestion()).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Este pago ya no existe. Mostramos la lista al día.');
    });

    it('puts the focus on the heading when the payment that held it is gone', async () => {
      const showing = { showPeriods: null };
      const reload = vi.fn(async () => { showing.showPeriods([NOVEMBER]); });
      showing.showPeriods = renderPeriods({ reload }).showPeriods;
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(rows()).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 3, name: 'Pagos registrados' })).toHaveFocus();
    });

    it('keeps one thing open at a time: asking about a delete closes a form', () => {
      renderPeriods();
      fireEvent.click(editButton(OCTOBER_TEXT));

      fireEvent.click(deleteButton(NOVEMBER_TEXT));

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(question()).toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
    });

    it('keeps one thing open at a time: opening a form closes the question', () => {
      renderPeriods();
      fireEvent.click(deleteButton(NOVEMBER_TEXT));

      fireEvent.click(editButton(OCTOBER_TEXT));

      expect(queryQuestion()).not.toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(deleteButton(NOVEMBER_TEXT)).toBeInTheDocument();
    });

    it('works with the keyboard end to end', async () => {
      const user = userEvent.setup();
      const { membership } = renderPeriods();

      deleteButton(OCTOBER_TEXT).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{Tab}');
      expect(confirmDelete()).toHaveFocus();
      await user.keyboard('{Enter}');

      expect(membership.deletePeriod).toHaveBeenCalledWith('p-1');
    });
  });

  // The answer "this payment is gone" belongs to the form or the question that
  // asked. The administrator can open something else while that is on its way
  // (only the buttons of the thing that is saving are off), and the notice must
  // not then sit next to something that has nothing to do with that payment.
  describe('a payment found gone after the administrator moved on', () => {
    const GONE = 'Este pago ya no existe. Mostramos la lista al día.';

    // The correction of October is on its way; the test settles it by hand.
    async function holdCorrectionOfOctober() {
      const pending = deferred();
      const membership = fakeMembership({ updatePeriod: vi.fn(() => pending.promise) });
      const view = renderPeriods({ membership });
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');
      await act(async () => { fireEvent.click(saveButton()); });
      return { ...view, pending };
    }

    it.each([
      [
        'the form of another payment',
        () => fireEvent.click(editButton(NOVEMBER_TEXT)),
        () => within(rows()[0]).getByRole('form', { name: 'Editar pago' }),
      ],
      [
        'the form to record a payment',
        () => fireEvent.click(addButton()),
        () => screen.getByRole('form', { name: 'Registrar pago' }),
      ],
      [
        'the question before a delete',
        () => fireEvent.click(deleteButton(NOVEMBER_TEXT)),
        () => question(),
      ],
    ])('says nothing, and leaves alone %s that was opened meanwhile', async (_label, openInstead, opened) => {
      const { reload, pending } = await holdCorrectionOfOctober();
      openInstead();
      const element = opened();

      await act(async () => { pending.resolve(fail('NOT_FOUND')); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GONE)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(opened()).toBe(element);
      expect(element).toContainElement(document.activeElement);
    });

    it('says nothing when what the administrator opened meanwhile was closed again', async () => {
      const { reload, pending } = await holdCorrectionOfOctober();
      fireEvent.click(editButton(NOVEMBER_TEXT));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      await act(async () => { pending.resolve(fail('NOT_FOUND')); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GONE)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('says nothing, and leaves alone the form opened meanwhile, when a delete finds the payment gone', async () => {
      const pending = deferred();
      const membership = fakeMembership({ deletePeriod: vi.fn(() => pending.promise) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));
      await act(async () => { fireEvent.click(confirmDelete()); });
      fireEvent.click(editButton(NOVEMBER_TEXT));
      const form = screen.getByRole('form', { name: 'Editar pago' });

      await act(async () => { pending.resolve(fail('NOT_FOUND')); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GONE)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBe(form);
    });

    it('still says so when the form that got the answer is the one that is open', async () => {
      const { reload, pending } = await holdCorrectionOfOctober();

      await act(async () => { pending.resolve(fail('NOT_FOUND')); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(GONE);
    });

    it('still says so when the question that got the answer is the one that is open', async () => {
      const pending = deferred();
      const membership = fakeMembership({ deletePeriod: vi.fn(() => pending.promise) });
      const { reload } = renderPeriods({ membership });
      fireEvent.click(deleteButton(OCTOBER_TEXT));
      await act(async () => { fireEvent.click(confirmDelete()); });

      await act(async () => { pending.resolve(fail('NOT_FOUND')); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(queryQuestion()).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(GONE);
    });

    // The other answers that read the member again: what the database holds may
    // differ from the screen whatever is open now, but there is nothing to say
    // about a form that was left, and the one opened meanwhile is not touched.
    it.each([
      ['worked', ok()],
      ['overlapped another payment', fail('OVERLAP')],
    ])('reads the member again, and leaves alone the form opened meanwhile, for a save that %s', async (_label, answer) => {
      const { reload, pending } = await holdCorrectionOfOctober();
      fireEvent.click(editButton(NOVEMBER_TEXT));
      const form = screen.getByRole('form', { name: 'Editar pago' });

      await act(async () => { pending.resolve(answer); });

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Editar pago' })).toBe(form);
    });
  });
});
