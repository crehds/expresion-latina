import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PeriodForm from './PeriodForm';

// 10:00 on 20 October 2026 in Lima: the day the form works from.
const NOW = new Date('2026-10-20T15:00:00Z');

const ok = () => ({ ok: true, data: null });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

// A call the test settles by hand, to hold a save in flight.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

function renderForm({
  periods = [],
  period = undefined,
  onSubmit = vi.fn(async () => ok()),
  onCancel = vi.fn(),
} = {}) {
  render(<PeriodForm periods={periods} period={period} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}

const startsOn = () => screen.getByLabelText('Fecha de inicio');
const endsOn = () => screen.getByLabelText('Fecha de fin');
const saveButton = () => screen.getByRole('button', { name: /^(Guardar|Guardando…)$/ });
const cancelButton = () => screen.getByRole('button', { name: 'Cancelar' });
const shortcut = (name) => screen.getByRole('button', { name });
const form = () => screen.getByRole('form');

// A date field only takes a complete 'YYYY-MM-DD', so the tests set it whole.
const setDate = (field, value) => fireEvent.change(field, { target: { value } });

describe('PeriodForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recording a payment', () => {
    it('is a form named after what it does, with two date fields and two buttons', () => {
      renderForm();

      expect(screen.getByRole('form', { name: 'Registrar pago' })).toBeInTheDocument();
      expect(startsOn()).toHaveAttribute('type', 'date');
      expect(endsOn()).toHaveAttribute('type', 'date');
      expect(saveButton()).toHaveAttribute('type', 'submit');
      expect(cancelButton()).toHaveAttribute('type', 'button');
    });

    it('puts the focus on the first field', () => {
      renderForm();

      expect(startsOn()).toHaveFocus();
    });

    it('starts today, with no end, when the member has no payment that has not ended', () => {
      renderForm({ periods: [] });

      expect(startsOn()).toHaveValue('2026-10-20');
      expect(endsOn()).toHaveValue('');
    });

    it('asks for the end: the field is required and starts empty', () => {
      renderForm();

      expect(endsOn()).toHaveAttribute('aria-required', 'true');
      expect(startsOn()).toHaveAttribute('aria-required', 'true');
    });

    it('starts the day after the latest payment that has not ended, a future one included', () => {
      renderForm({
        periods: [
          { id: 'a', startsOn: '2026-11-01', endsOn: '2026-11-15' },
          { id: 'b', startsOn: '2026-10-01', endsOn: '2026-10-25' },
        ],
      });

      expect(startsOn()).toHaveValue('2026-11-16');
    });

    it('starts the day after a payment that ends today, which still covers today', () => {
      renderForm({ periods: [{ id: 'a', startsOn: '2026-09-21', endsOn: '2026-10-20' }] });

      expect(startsOn()).toHaveValue('2026-10-21');
    });

    it('starts today when every payment has already ended', () => {
      renderForm({ periods: [{ id: 'a', startsOn: '2026-08-01', endsOn: '2026-09-30' }] });

      expect(startsOn()).toHaveValue('2026-10-20');
    });

    it('does not break on a payment date that is no calendar day', () => {
      const { unmount } = render(
        <PeriodForm
          periods={[
            { id: 'a', startsOn: '2026-10-01', endsOn: 'zzz-not-a-date' },
            { id: 'b', startsOn: '2026-11-01', endsOn: '2026-11-15' },
          ]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(startsOn()).toHaveValue('2026-11-16');
      unmount();

      renderForm({ periods: [{ id: 'a', startsOn: '2026-10-01', endsOn: 'zzz-not-a-date' }] });
      expect(startsOn()).toHaveValue('2026-10-20');
    });

    describe('the shortcuts for the end', () => {
      it('"+1 mes" fills the end a month after the start, the last day included', () => {
        renderForm();

        fireEvent.click(shortcut('+1 mes'));

        expect(endsOn()).toHaveValue('2026-11-19');
      });

      it('"+1 año" fills the end a year after the start, the last day included', () => {
        renderForm();

        fireEvent.click(shortcut('+1 año'));

        expect(endsOn()).toHaveValue('2027-10-19');
      });

      it('works from the start the administrator wrote, not from the one it began with', () => {
        renderForm();
        setDate(startsOn(), '2026-01-15');

        fireEvent.click(shortcut('+1 mes'));

        expect(endsOn()).toHaveValue('2026-02-14');
      });

      it('ends a month that began on the 31st on the last day of the shorter month', () => {
        renderForm();
        setDate(startsOn(), '2026-01-31');

        fireEvent.click(shortcut('+1 mes'));

        expect(endsOn()).toHaveValue('2026-02-28');
      });

      it('lets the second shortcut replace the first', () => {
        renderForm();

        fireEvent.click(shortcut('+1 mes'));
        fireEvent.click(shortcut('+1 año'));

        expect(endsOn()).toHaveValue('2027-10-19');
      });

      it('leaves the end editable, and sends what was edited', async () => {
        const { onSubmit } = renderForm();
        fireEvent.click(shortcut('+1 mes'));

        setDate(endsOn(), '2026-11-30');
        fireEvent.submit(form());

        expect(endsOn()).toHaveValue('2026-11-30');
        expect(onSubmit).toHaveBeenCalledWith({ startsOn: '2026-10-20', endsOn: '2026-11-30' });
      });

      it('does nothing but ask for the start when the start is not a date', () => {
        renderForm();
        setDate(startsOn(), '');

        fireEvent.click(shortcut('+1 mes'));

        expect(endsOn()).toHaveValue('');
        expect(screen.getByText('Indica la fecha de inicio.')).toBeInTheDocument();
        expect(startsOn()).toHaveFocus();
      });

      it('clears the complaint about the end once it fills it', () => {
        renderForm();
        fireEvent.submit(form());
        expect(screen.getByText('Indica la fecha de fin.')).toBeInTheDocument();

        fireEvent.click(shortcut('+1 mes'));

        expect(screen.queryByText('Indica la fecha de fin.')).not.toBeInTheDocument();
      });

      it('groups the shortcuts under a name of their own', () => {
        renderForm();

        expect(screen.getByRole('group', { name: 'Atajos para la fecha de fin' })).toContainElement(
          shortcut('+1 mes'),
        );
        expect(screen.getByRole('group', { name: 'Atajos para la fecha de fin' })).toContainElement(
          shortcut('+1 año'),
        );
      });
    });

    describe('checking the dates before it asks the backend', () => {
      it('asks for the end when it is empty, and does not send anything', () => {
        const { onSubmit } = renderForm();

        fireEvent.submit(form());

        expect(screen.getByText('Indica la fecha de fin.')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
        expect(endsOn()).toHaveFocus();
      });

      it('refuses an end that comes before the start', () => {
        const { onSubmit } = renderForm();
        setDate(endsOn(), '2026-10-19');

        fireEvent.submit(form());

        expect(screen.getByText('La fecha de fin no puede ser anterior a la de inicio.'))
          .toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('accepts a payment of one day, which ends the day it starts', () => {
        const { onSubmit } = renderForm();
        setDate(endsOn(), '2026-10-20');

        fireEvent.submit(form());

        expect(onSubmit).toHaveBeenCalledWith({ startsOn: '2026-10-20', endsOn: '2026-10-20' });
      });

      it('names both fields when neither is a date, and focuses the first', () => {
        const { onSubmit } = renderForm();
        setDate(startsOn(), '');

        fireEvent.submit(form());

        expect(screen.getByText('Indica la fecha de inicio.')).toBeInTheDocument();
        expect(screen.getByText('Indica la fecha de fin.')).toBeInTheDocument();
        expect(startsOn()).toHaveFocus();
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('marks a wrong field and ties its message to it', () => {
        renderForm();

        fireEvent.submit(form());

        expect(endsOn()).toHaveAttribute('aria-invalid', 'true');
        const message = screen.getByText('Indica la fecha de fin.');
        expect(endsOn().getAttribute('aria-describedby')).toContain(message.id);
        expect(startsOn()).not.toHaveAttribute('aria-invalid');
      });

      it('stops complaining once the dates are right', () => {
        const { onSubmit } = renderForm();
        fireEvent.submit(form());

        setDate(endsOn(), '2026-11-19');
        fireEvent.submit(form());

        expect(screen.queryByText('Indica la fecha de fin.')).not.toBeInTheDocument();
        expect(endsOn()).not.toHaveAttribute('aria-invalid');
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('takes the dates typed by hand', async () => {
        const user = userEvent.setup();
        const { onSubmit } = renderForm();

        await user.clear(startsOn());
        await user.type(startsOn(), '2026-12-01');
        await user.type(endsOn(), '2026-12-31');
        await user.click(saveButton());

        expect(onSubmit).toHaveBeenCalledWith({ startsOn: '2026-12-01', endsOn: '2026-12-31' });
      });
    });

    describe('saving', () => {
      const valid = () => setDate(endsOn(), '2026-11-19');

      it('sends the two dates as they are written, once', () => {
        const { onSubmit } = renderForm();
        valid();

        fireEvent.submit(form());

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith({ startsOn: '2026-10-20', endsOn: '2026-11-19' });
      });

      it('keeps both buttons off, and says so, while the save is on its way', async () => {
        const pending = deferred();
        renderForm({ onSubmit: vi.fn(() => pending.promise) });
        valid();

        fireEvent.submit(form());

        expect(saveButton()).toBeDisabled();
        expect(saveButton()).toHaveTextContent('Guardando…');
        expect(cancelButton()).toBeDisabled();

        await act(async () => { pending.resolve(ok()); });

        expect(saveButton()).toBeEnabled();
        expect(saveButton()).toHaveTextContent('Guardar');
        expect(cancelButton()).toBeEnabled();
      });

      it('sends nothing more while a save is on its way, even for a submit in the same instant', async () => {
        const pending = deferred();
        const { onSubmit } = renderForm({ onSubmit: vi.fn(() => pending.promise) });
        valid();

        // Both events arrive before React has drawn the disabled button.
        act(() => {
          form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        await act(async () => { pending.resolve(ok()); });

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('can be sent again once the first save has ended', async () => {
        const { onSubmit } = renderForm({
          onSubmit: vi.fn()
            .mockResolvedValueOnce(fail('NETWORK'))
            .mockResolvedValueOnce(ok()),
        });
        valid();

        await act(async () => { fireEvent.submit(form()); });
        await act(async () => { fireEvent.submit(form()); });

        expect(onSubmit).toHaveBeenCalledTimes(2);
      });

      it('shows no complaint after a save that worked', async () => {
        renderForm();
        valid();

        await act(async () => { fireEvent.submit(form()); });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    describe('when the save fails', () => {
      const valid = () => setDate(endsOn(), '2026-11-19');

      it.each([
        ['INVALID', 'Revisa las fechas: el fin no puede ser anterior al inicio y un pago no puede durar más de 5 años.'],
        ['OVERLAP', 'Esas fechas se cruzan con otro pago de este miembro. Cambia las fechas e inténtalo de nuevo.'],
        ['NOT_FOUND', 'Este pago ya no existe. Mostramos la lista al día.'],
        ['FORBIDDEN', 'No tienes permiso para guardar este pago o tu sesión venció. Vuelve a ingresar.'],
        ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
        ['UNKNOWN', 'No pudimos guardar el pago. Inténtalo de nuevo.'],
        ['SOMETHING_ELSE', 'No pudimos guardar el pago. Inténtalo de nuevo.'],
      ])('shows the fixed message of the code %s in an alert', async (code, message) => {
        renderForm({ onSubmit: vi.fn(async () => fail(code)) });
        valid();

        await act(async () => { fireEvent.submit(form()); });

        expect(screen.getByRole('alert')).toHaveTextContent(message);
      });

      it('keeps what was typed, and the form usable, so the dates can be changed', async () => {
        renderForm({ onSubmit: vi.fn(async () => fail('OVERLAP')) });
        valid();

        await act(async () => { fireEvent.submit(form()); });

        expect(startsOn()).toHaveValue('2026-10-20');
        expect(endsOn()).toHaveValue('2026-11-19');
        expect(saveButton()).toBeEnabled();
        expect(cancelButton()).toBeEnabled();
      });

      it('never shows what the backend said, only the message of the code', async () => {
        renderForm({
          onSubmit: vi.fn(async () => fail('OVERLAP', {
            message: 'ana@example.test overlaps',
            details: 'Key (member_id)=(0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90) conflicts with [2026-10-01,2026-10-31]',
          })),
        });
        valid();

        await act(async () => { fireEvent.submit(form()); });

        expect(document.body).not.toHaveTextContent(/ana@example|member_id|0b1a4c6e|2026-10-01/);
      });

      it('takes a save that threw for an unknown failure and frees the form', async () => {
        renderForm({ onSubmit: vi.fn(async () => { throw new Error('boom ana@example.test'); }) });
        valid();

        await act(async () => { fireEvent.submit(form()); });

        expect(screen.getByRole('alert'))
          .toHaveTextContent('No pudimos guardar el pago. Inténtalo de nuevo.');
        expect(document.body).not.toHaveTextContent(/boom|ana@example/);
        expect(saveButton()).toBeEnabled();
      });

      it('clears the failure while the next attempt is on its way', async () => {
        const pending = deferred();
        renderForm({
          onSubmit: vi.fn()
            .mockResolvedValueOnce(fail('NETWORK'))
            .mockReturnValueOnce(pending.promise),
        });
        valid();
        await act(async () => { fireEvent.submit(form()); });
        expect(screen.getByRole('alert')).toBeInTheDocument();

        fireEvent.submit(form());

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await act(async () => { pending.resolve(ok()); });
      });
    });

    describe('cancelling', () => {
      it('tells the parent', () => {
        const { onCancel } = renderForm();

        fireEvent.click(cancelButton());

        expect(onCancel).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('correcting a payment', () => {
    const period = { id: 'p-1', startsOn: '2026-10-01', endsOn: '2026-10-31' };

    it('is a form named after what it does, with the dates of the payment', () => {
      renderForm({ period });

      expect(screen.getByRole('form', { name: 'Editar pago' })).toBeInTheDocument();
      expect(startsOn()).toHaveValue('2026-10-01');
      expect(endsOn()).toHaveValue('2026-10-31');
    });

    it('starts from the payment, whatever the other payments suggest', () => {
      renderForm({
        period,
        periods: [period, { id: 'p-2', startsOn: '2026-11-01', endsOn: '2026-11-30' }],
      });

      expect(startsOn()).toHaveValue('2026-10-01');
    });

    it('offers the shortcuts, which count from the start of the payment', () => {
      renderForm({ period });

      fireEvent.click(shortcut('+1 mes'));
      expect(endsOn()).toHaveValue('2026-10-31');

      fireEvent.click(shortcut('+1 año'));
      expect(endsOn()).toHaveValue('2027-09-30');
    });

    it('sends the corrected dates', () => {
      const { onSubmit } = renderForm({ period });
      setDate(endsOn(), '2026-10-15');

      fireEvent.submit(form());

      expect(onSubmit).toHaveBeenCalledWith({ startsOn: '2026-10-01', endsOn: '2026-10-15' });
    });

    it('puts the focus on the first field, as when recording', () => {
      renderForm({ period });

      expect(startsOn()).toHaveFocus();
    });

    it('does not break on a date that is no calendar day, and asks for it again', () => {
      const { onSubmit } = renderForm({
        period: { id: 'p-1', startsOn: 'zzz-not-a-date', endsOn: '2026-10-31' },
      });

      expect(startsOn()).toHaveValue('');
      expect(endsOn()).toHaveValue('2026-10-31');

      fireEvent.submit(form());

      expect(screen.getByText('La fecha de inicio no es válida.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
