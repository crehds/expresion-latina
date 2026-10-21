import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import BackendContext from '../../../shared/backend/BackendContext';
import MemberDetail from './MemberDetail';

// 10:00 on 20 October 2026 in Lima: the day a new payment starts from.
const NOW = new Date('2026-10-20T15:00:00Z');

const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

const ok = (data = null) => ({ ok: true, data });
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });

// A call the test settles by hand, to hold it in flight.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const ANA = {
  id: ID,
  fullName: 'Ana Perez',
  email: 'ana@example.test',
  paidUntil: '2026-10-31',
  isActive: true,
};
const OCTOBER = {
  id: 'p-1', memberId: ID, startsOn: '2026-10-01', endsOn: '2026-10-31',
};
const NOVEMBER = {
  id: 'p-2', memberId: ID, startsOn: '2026-11-01', endsOn: '2026-11-30',
};
const OCTOBER_TEXT = 'Del 1 de octubre de 2026 al 31 de octubre de 2026';
const NOVEMBER_TEXT = 'Del 1 de noviembre de 2026 al 30 de noviembre de 2026';

function fakeMembership(overrides = {}) {
  return {
    getMember: vi.fn(async () => ok(ANA)),
    listPeriods: vi.fn(async () => ok([OCTOBER])),
    createPeriod: vi.fn(async () => ok()),
    updatePeriod: vi.fn(async () => ok()),
    deletePeriod: vi.fn(async () => ok()),
    ...overrides,
  };
}

function tree({ memberId, services, strict }) {
  const content = (
    <MemoryRouter>
      <BackendContext.Provider value={{ enabled: true, services }}>
        <MemberDetail memberId={memberId} />
      </BackendContext.Provider>
    </MemoryRouter>
  );
  return strict ? <StrictMode>{content}</StrictMode> : content;
}

// `memberId: undefined` is a case of its own (an address with no id), so it is
// read from the options and not given a default.
function renderDetail({
  membership = fakeMembership(),
  services = { membership },
  strict = false,
  ...options
} = {}) {
  const memberId = 'memberId' in options ? options.memberId : ID;
  return { membership, ...render(tree({ memberId, services, strict })) };
}

const title = (name) => screen.findByRole('heading', { level: 2, name });
const loaded = () => title('Ana Perez');
const periodsRegion = () => screen.queryByRole('region', { name: 'Pagos registrados' });
const rows = () => screen.queryAllByRole('listitem');
const addButton = () => screen.getByRole('button', { name: 'Registrar pago' });
const endsOn = () => screen.getByLabelText('Fecha de fin');
const setDate = (field, value) => fireEvent.change(field, { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Guardar' });
const editButton = (text) => screen.getByRole('button', { name: `Editar el pago: ${text}` });
const deleteButton = (text) => screen.getByRole('button', { name: `Eliminar el pago: ${text}` });
const confirmDelete = () => screen.getByRole('button', { name: 'Sí, eliminar el pago' });

describe('MemberDetail', () => {
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
      const { container } = renderDetail({ services });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('reading the member', () => {
    it('asks for the member and the payments together, by the id, before either answers', async () => {
      const member = deferred();
      const periods = deferred();
      const membership = fakeMembership({
        getMember: vi.fn(() => member.promise),
        listPeriods: vi.fn(() => periods.promise),
      });

      renderDetail({ membership });

      expect(membership.getMember).toHaveBeenCalledTimes(1);
      expect(membership.getMember).toHaveBeenCalledWith(ID);
      expect(membership.listPeriods).toHaveBeenCalledTimes(1);
      expect(membership.listPeriods).toHaveBeenCalledWith(ID);

      await act(async () => {
        member.resolve(ok(ANA));
        periods.resolve(ok([OCTOBER]));
      });
    });

    it('says it is loading, with the way back to the directory, until the member arrives', async () => {
      const member = deferred();
      renderDetail({ membership: fakeMembership({ getMember: vi.fn(() => member.promise) }) });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando al miembro…');
      expect(screen.getByRole('heading', { level: 2, name: 'Miembro' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a miembros' }))
        .toHaveAttribute('href', '/admin/members');
      expect(periodsRegion()).not.toBeInTheDocument();

      await act(async () => { member.resolve(ok(ANA)); });

      expect(await loaded()).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('waits for the payments too before it shows the member', async () => {
      const periods = deferred();
      renderDetail({ membership: fakeMembership({ listPeriods: vi.fn(() => periods.promise) }) });

      await act(async () => {});

      expect(screen.getByRole('status')).toHaveTextContent('Cargando al miembro…');
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();

      await act(async () => { periods.resolve(ok([OCTOBER])); });

      expect(await loaded()).toBeInTheDocument();
    });

    it('shows the member once, also when the effects run twice', async () => {
      renderDetail({ strict: true });

      expect(await loaded()).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3, name: 'Pagos registrados' })).toHaveLength(1);
      expect(rows()).toHaveLength(1);
    });
  });

  describe('the member', () => {
    it('is a section named after them, with the way back to the directory', async () => {
      renderDetail();
      await loaded();

      const section = screen.getByRole('region', { name: 'Ana Perez' });
      expect(within(section).getByRole('heading', { level: 2, name: 'Ana Perez' })).toBeInTheDocument();
      expect(within(section).getByRole('link', { name: 'Volver a miembros' }))
        .toHaveAttribute('href', '/admin/members');
    });

    it('shows the email, and the status the server sent with the date the payments run to', async () => {
      renderDetail();
      await loaded();

      expect(screen.getByText('ana@example.test')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Pagado hasta 31 de octubre de 2026')).toBeInTheDocument();
      expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
    });

    it('shows a member who is not active with their last due date', async () => {
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({ ...ANA, isActive: false, paidUntil: '2026-08-15' })),
        }),
      });
      await loaded();

      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Último vencimiento: 15 de agosto de 2026')).toBeInTheDocument();
      expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    });

    it('says a member with no payments has none, and offers to record the first', async () => {
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({ ...ANA, isActive: false, paidUntil: null })),
          listPeriods: vi.fn(async () => ok([])),
        }),
      });
      await loaded();

      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Sin pagos registrados')).toBeInTheDocument();
      expect(screen.getByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
      expect(addButton()).toBeInTheDocument();
    });

    it('takes the status from the server and not from the list of payments', async () => {
      // The server says active, though the list holds nothing: the list is not what decides.
      const { unmount } = renderDetail({
        membership: fakeMembership({ listPeriods: vi.fn(async () => ok([])) }),
      });
      await loaded();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Pagado hasta 31 de octubre de 2026')).toBeInTheDocument();
      unmount();

      // The server says inactive, though a payment in the list covers today.
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({ ...ANA, isActive: false, paidUntil: '2026-08-15' })),
        }),
      });
      await loaded();
      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Último vencimiento: 15 de agosto de 2026')).toBeInTheDocument();
    });

    it('survives a date that is no calendar day, with a neutral line that does not echo it', async () => {
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({ ...ANA, paidUntil: 'internal-detail-7' })),
        }),
      });
      await loaded();

      expect(screen.getByText('Fecha de pago no disponible')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(/internal-detail-7/)).not.toBeInTheDocument();
    });

    it('falls back on the plain title for a member who has no name, and still shows the email', async () => {
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({ ...ANA, fullName: '   ' })),
        }),
      });

      expect(await screen.findByText('ana@example.test')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Miembro' })).toBeInTheDocument();
    });

    it('shows nothing of the member but the name, the email, the status and the payments', async () => {
      renderDetail({
        membership: fakeMembership({
          getMember: vi.fn(async () => ok({
            ...ANA,
            isAdmin: true,
            consentAt: '2026-01-01T00:00:00Z',
            consentVersion: 'consent-version-x',
          })),
          listPeriods: vi.fn(async () => ok([{ ...OCTOBER, recordedBy: 'recorded-by-admin-x' }])),
        }),
      });
      await loaded();

      expect(document.body).not.toHaveTextContent(
        /consent|recorded-by-admin-x|true|p-1|3b241101/i,
      );
    });

    it('lists their payments newest first, with the buttons to correct and delete them', async () => {
      renderDetail({
        membership: fakeMembership({ listPeriods: vi.fn(async () => ok([NOVEMBER, OCTOBER])) }),
      });
      await loaded();

      const region = periodsRegion();
      expect(within(region).getByRole('heading', { level: 3, name: 'Pagos registrados' }))
        .toBeInTheDocument();
      expect(within(rows()[0]).getByText(NOVEMBER_TEXT)).toBeInTheDocument();
      expect(within(rows()[1]).getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(editButton(OCTOBER_TEXT)).toBeInTheDocument();
      expect(deleteButton(OCTOBER_TEXT)).toBeInTheDocument();
    });
  });

  describe('a member who is not there', () => {
    it('says so, keeps the payments away and offers the way back, without a retry', async () => {
      const membership = fakeMembership({ getMember: vi.fn(async () => fail('NOT_FOUND')) });
      renderDetail({ membership });

      expect(await title('Miembro no encontrado')).toBeInTheDocument();
      expect(screen.getByText('No encontramos a este miembro.')).toBeInTheDocument();
      expect(screen.getByText(
        'Solo aparecen quienes aceptaron el aviso de privacidad y confirmaron su correo.',
      )).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a miembros' }))
        .toHaveAttribute('href', '/admin/members');
      expect(periodsRegion()).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([
      ['empty', ''],
      ['a word', 'member-1'],
      ['one digit short', '3b241101-e2bb-4255-8caf-4136c566a96'],
      ['an id between braces', `{${ID}}`],
      ['a path', `../${ID}`],
      ['an id and something more', `${ID}%20x`],
      ['nothing at all', undefined],
    ])('asks for nothing when the id is %s, and says the member is not there', async (_label, memberId) => {
      const { membership } = renderDetail({ memberId });

      expect(screen.getByRole('heading', { level: 2, name: 'Miembro no encontrado' }))
        .toBeInTheDocument();
      expect(screen.getByText('No encontramos a este miembro.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a miembros' })).toBeInTheDocument();

      await act(async () => {});

      expect(membership.getMember).not.toHaveBeenCalled();
      expect(membership.listPeriods).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('a read that failed', () => {
    it.each([
      ['NETWORK', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'],
      ['FORBIDDEN', 'No tienes permiso para ver a este miembro o tu sesión venció. Vuelve a ingresar.'],
      ['UNKNOWN', 'No pudimos cargar al miembro. Inténtalo de nuevo.'],
      ['INVALID', 'No pudimos cargar al miembro. Inténtalo de nuevo.'],
    ])('shows the fixed message of %s, never what the backend said, and offers to try again', async (code, message) => {
      const membership = fakeMembership({
        getMember: vi.fn(async () => fail(code, { message: 'ana@example.test', details: 'Key (id)=(p-1)' })),
      });
      renderDetail({ membership });

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(document.body).not.toHaveTextContent(/ana@example|Key \(id\)/);
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a miembros' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Miembro' })).toBeInTheDocument();
      expect(periodsRegion()).not.toBeInTheDocument();
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    });

    // A failure always says so: the alert follows the failure, not the code.
    it.each([
      ['member', { getMember: vi.fn(async () => ({ ok: false })) }],
      ['payments', { listPeriods: vi.fn(async () => ({ ok: false })) }],
    ])('shows the generic message in an alert when the read of the %s fails with no code', async (_label, calls) => {
      renderDetail({ membership: fakeMembership(calls) });

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos cargar al miembro. Inténtalo de nuevo.');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(periodsRegion()).not.toBeInTheDocument();
    });

    it('does not show the member either when only the payments failed', async () => {
      const membership = fakeMembership({ listPeriods: vi.fn(async () => fail('NETWORK')) });
      renderDetail({ membership });

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
      expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
      expect(periodsRegion()).not.toBeInTheDocument();
    });

    it('names the failure of the member when both reads failed', async () => {
      const membership = fakeMembership({
        getMember: vi.fn(async () => fail('FORBIDDEN')),
        listPeriods: vi.fn(async () => fail('NETWORK')),
      });
      renderDetail({ membership });

      expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para ver a este miembro');
    });

    it('takes a call that threw for an unknown failure instead of waiting for ever', async () => {
      const membership = fakeMembership({
        getMember: vi.fn(async () => { throw new Error('boom'); }),
      });
      renderDetail({ membership });

      expect(await screen.findByRole('alert'))
        .toHaveTextContent('No pudimos cargar al miembro. Inténtalo de nuevo.');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('reads both again from the button, saying it is loading, and shows the member', async () => {
      const membership = fakeMembership({
        getMember: vi.fn().mockResolvedValueOnce(fail('NETWORK')).mockResolvedValue(ok(ANA)),
        listPeriods: vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([OCTOBER])),
      });
      renderDetail({ membership });
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(screen.getByRole('status')).toHaveTextContent('Cargando al miembro…');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(await loaded()).toBeInTheDocument();
      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
    });
  });

  describe('after a change', () => {
    it('reads the member and the payments again after a payment is recorded, and shows what the database holds', async () => {
      const membership = fakeMembership({
        getMember: vi.fn()
          .mockResolvedValueOnce(ok({ ...ANA, isActive: false, paidUntil: null }))
          .mockResolvedValue(ok(ANA)),
        listPeriods: vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([OCTOBER])),
      });
      renderDetail({ membership });
      await screen.findByText('Sin pagos registrados');
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-10-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.createPeriod).toHaveBeenCalledWith({
        memberId: ID, startsOn: '2026-10-20', endsOn: '2026-10-31',
      });
      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.getMember).toHaveBeenLastCalledWith(ID);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenLastCalledWith(ID);
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Pagado hasta 31 de octubre de 2026')).toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('reads both again after a payment is corrected', async () => {
      const membership = fakeMembership({
        getMember: vi.fn()
          .mockResolvedValueOnce(ok(ANA))
          .mockResolvedValue(ok({ ...ANA, isActive: false, paidUntil: '2026-10-15' })),
        listPeriods: vi.fn()
          .mockResolvedValueOnce(ok([OCTOBER]))
          .mockResolvedValue(ok([{ ...OCTOBER, endsOn: '2026-10-15' }])),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(editButton(OCTOBER_TEXT));
      setDate(endsOn(), '2026-10-15');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.updatePeriod).toHaveBeenCalledWith('p-1', {
        startsOn: '2026-10-01', endsOn: '2026-10-15',
      });
      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Último vencimiento: 15 de octubre de 2026')).toBeInTheDocument();
      expect(screen.getByText('Del 1 de octubre de 2026 al 15 de octubre de 2026')).toBeInTheDocument();
    });

    it('reads both again after a payment is deleted', async () => {
      const membership = fakeMembership({
        getMember: vi.fn()
          .mockResolvedValueOnce(ok(ANA))
          .mockResolvedValue(ok({ ...ANA, isActive: false, paidUntil: null })),
        listPeriods: vi.fn().mockResolvedValueOnce(ok([OCTOBER])).mockResolvedValue(ok([])),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(membership.deletePeriod).toHaveBeenCalledWith('p-1');
      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(screen.getByText('Sin pagos registrados')).toBeInTheDocument();
      expect(screen.getByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
    });

    it('reads both again when the dates overlap, and shows the payment that is in the way', async () => {
      const membership = fakeMembership({
        createPeriod: vi.fn(async () => fail('OVERLAP')),
        listPeriods: vi.fn()
          .mockResolvedValueOnce(ok([OCTOBER]))
          .mockResolvedValue(ok([NOVEMBER, OCTOBER])),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toHaveTextContent('Esas fechas se cruzan con otro pago');
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByText(NOVEMBER_TEXT)).toBeInTheDocument();
    });

    it('reads both again when the payment turns out to be gone', async () => {
      const membership = fakeMembership({
        deletePeriod: vi.fn(async () => fail('NOT_FOUND')),
        listPeriods: vi.fn().mockResolvedValueOnce(ok([OCTOBER])).mockResolvedValue(ok([])),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(deleteButton(OCTOBER_TEXT));

      await act(async () => { fireEvent.click(confirmDelete()); });

      expect(membership.getMember).toHaveBeenCalledTimes(2);
      expect(membership.listPeriods).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toHaveTextContent('Este pago ya no existe. Mostramos la lista al día.');
      expect(screen.getByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
    });

    it('reads nothing again after a failure that changed nothing', async () => {
      const membership = fakeMembership({ createPeriod: vi.fn(async () => fail('NETWORK')) });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.getMember).toHaveBeenCalledTimes(1);
      expect(membership.listPeriods).toHaveBeenCalledTimes(1);
    });

    it('keeps the member and the payments on screen, and the form busy, while it reads again', async () => {
      const again = deferred();
      const membership = fakeMembership({
        getMember: vi.fn()
          .mockResolvedValueOnce(ok(ANA))
          .mockImplementationOnce(() => again.promise),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-12-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(screen.getByRole('heading', { level: 2, name: 'Ana Perez' })).toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      await act(async () => { again.resolve(ok(ANA)); });

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('shows the failure, and a way to try again, when it cannot read the member after a change that worked', async () => {
      const membership = fakeMembership({
        getMember: vi.fn()
          .mockResolvedValueOnce(ok(ANA))
          .mockResolvedValueOnce(fail('NETWORK'))
          .mockResolvedValue(ok(ANA)),
        listPeriods: vi.fn()
          .mockResolvedValueOnce(ok([]))
          .mockResolvedValueOnce(ok([OCTOBER]))
          .mockResolvedValue(ok([OCTOBER])),
      });
      renderDetail({ membership });
      await loaded();
      fireEvent.click(addButton());
      setDate(endsOn(), '2026-10-31');

      await act(async () => { fireEvent.click(saveButton()); });

      expect(membership.createPeriod).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert'))
        .toHaveTextContent('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
      expect(periodsRegion()).not.toBeInTheDocument();

      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); });

      expect(await loaded()).toBeInTheDocument();
      expect(screen.getByText(OCTOBER_TEXT)).toBeInTheDocument();
      expect(membership.createPeriod).toHaveBeenCalledTimes(1);
    });

    it('lets the answer of the latest read win over an older one that arrives later', async () => {
      const stale = deferred();
      const FRESH = { ...NOVEMBER, endsOn: '2026-11-15' };
      const membership = fakeMembership({
        listPeriods: vi.fn()
          .mockResolvedValueOnce(ok([NOVEMBER, OCTOBER]))
          .mockImplementationOnce(() => stale.promise)
          .mockResolvedValue(ok([FRESH])),
      });
      renderDetail({ membership });
      await loaded();

      // The first change ends, and the read that follows it is held in flight.
      fireEvent.click(deleteButton(OCTOBER_TEXT));
      await act(async () => { fireEvent.click(confirmDelete()); });

      // A second change ends meanwhile, and its read answers at once.
      fireEvent.click(editButton(NOVEMBER_TEXT));
      setDate(endsOn(), '2026-11-15');
      await act(async () => { fireEvent.click(saveButton()); });
      expect(screen.getByText('Del 1 de noviembre de 2026 al 15 de noviembre de 2026'))
        .toBeInTheDocument();

      // The older read answers last, with a list that no longer is true.
      await act(async () => { stale.resolve(ok([NOVEMBER])); });

      expect(screen.getByText('Del 1 de noviembre de 2026 al 15 de noviembre de 2026'))
        .toBeInTheDocument();
      expect(screen.queryByText(NOVEMBER_TEXT)).not.toBeInTheDocument();
    });
  });
});
