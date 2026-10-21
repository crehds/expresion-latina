import { createAttendanceAdapter } from './attendanceAdapter';

const MEMBER_A = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const MEMBER_B = '5f3d9c21-8a64-4b7e-b1c0-6e2a9d4f8c13';

// An occurrence as occurrences.js builds it: the seven columns the table grants
// an INSERT on, plus `startsAt`, which the database computes and must never be sent.
const OCCURRENCE = {
  classDate: '2026-10-26',
  startTime: '19:00',
  endTime: '20:00',
  genreId: 'salsa',
  roomKey: 'sala-1',
  genreName: 'Salsa',
  roomLabel: 'Sala 1',
  startsAt: new Date('2026-10-27T00:00:00Z'),
};

// The rows of public.attendance_confirmations as PostgREST returns them: Postgres
// prints a `time` column as HH:MM:SS.
const ROWS = [
  {
    id: 'c-a1',
    member_id: MEMBER_A,
    class_date: '2026-10-26',
    start_time: '19:00:00',
    end_time: '20:00:00',
    genre_id: 'salsa',
    room_key: 'sala-1',
    genre_name: 'Salsa',
    room_label: 'Sala 1',
    starts_at: '2026-10-27T00:00:00+00:00',
  },
  {
    id: 'c-b1',
    member_id: MEMBER_B,
    class_date: '2026-10-27',
    start_time: '18:00:00',
    end_time: '19:00:00',
    genre_id: 'bachata',
    room_key: 'sala-1',
    genre_name: 'Bachata',
    room_label: 'Sala 1',
    starts_at: '2026-10-27T23:00:00+00:00',
  },
  {
    id: 'c-a0',
    member_id: MEMBER_A,
    class_date: '2026-10-10',
    start_time: '18:00:00',
    end_time: '19:00:00',
    genre_id: 'bachata',
    room_key: 'sala-1',
    genre_name: 'Bachata',
    room_label: 'Sala 1',
    starts_at: '2026-10-10T23:00:00+00:00',
  },
];

// The body PostgREST answers with when a statement fails; the text names a member.
const postgrestError = (code) => ({
  code,
  message: `private detail ${MEMBER_A}`,
  details: `Key (member_id)=(${MEMBER_A}) already exists.`,
  hint: null,
});

const LEAKS = /0b1a4c6e|private detail|member_id/;

// A stand-in for the part of PostgREST the adapter talks to. It keeps one table
// in memory, applies the eq / gte filters the way PostgREST does, and answers a
// delete with the rows it removed only when the request chains .select(). A
// delete that matches nothing succeeds with an empty answer, as RLS makes it.
// `requests` logs every statement in order.
function fakeClient({ rows = ROWS, error = null } = {}) {
  const table = rows.map((row) => ({ ...row }));
  const requests = [];

  // Postgres compares a `time` by value, so '19:00' matches a stored '19:00:00'.
  const comparable = (column, value) => (
    column.endsWith('_time') && typeof value === 'string' ? value.slice(0, 5) : value
  );

  function matches(row, state) {
    return state.filters.every(([operator, column, value]) => (
      operator === 'eq'
        ? comparable(column, row[column]) === comparable(column, value)
        : row[column] >= value
    ));
  }

  function execute(state) {
    if (error) return { data: null, error };
    if (state.operation === 'insert') {
      table.push({ id: `c-${table.length}`, ...state.values });
      return { data: null, error: null };
    }
    const matching = table.filter((row) => matches(row, state));
    if (state.operation === 'delete') {
      matching.forEach((row) => table.splice(table.indexOf(row), 1));
      return { data: state.returning ? matching.map(({ id }) => ({ id })) : null, error: null };
    }
    return { data: matching, error: null };
  }

  function from(name) {
    const state = {
      table: name, operation: 'select', columns: null, values: null, filters: [], returning: false,
    };
    const builder = {
      select(columns) {
        if (state.operation === 'select') state.columns = columns;
        else state.returning = columns ?? true;
        return builder;
      },
      insert(values, ...rest) {
        state.operation = 'insert';
        state.values = values;
        state.extra = rest;
        return builder;
      },
      delete() {
        state.operation = 'delete';
        return builder;
      },
      eq(column, value) {
        state.filters.push(['eq', column, value]);
        return builder;
      },
      gte(column, value) {
        state.filters.push(['gte', column, value]);
        return builder;
      },
      then(resolve, reject) {
        requests.push({ ...state, filters: [...state.filters] });
        return Promise.resolve(execute(state)).then(resolve, reject);
      },
    };
    return builder;
  }

  return { from, requests, table };
}

const adapterOver = (client) => createAttendanceAdapter(async () => client);

describe('createAttendanceAdapter', () => {
  describe('listOwnConfirmations', () => {
    it('returns the own confirmations from the date on, as camelCase occurrences', async () => {
      const client = fakeClient();

      const result = await adapterOver(client).listOwnConfirmations({
        userId: MEMBER_A,
        fromDate: '2026-10-20',
      });

      expect(result).toEqual({
        ok: true,
        data: [{
          classDate: '2026-10-26',
          startTime: '19:00',
          endTime: '20:00',
          genreId: 'salsa',
          roomKey: 'sala-1',
          genreName: 'Salsa',
          roomLabel: 'Sala 1',
        }],
      });
    });

    it('filters on the member: an administrator policy would otherwise return everyone', async () => {
      const client = fakeClient();

      await adapterOver(client).listOwnConfirmations({ userId: MEMBER_A, fromDate: '2026-10-01' });

      expect(client.requests).toHaveLength(1);
      expect(client.requests[0].table).toBe('attendance_confirmations');
      expect(client.requests[0].filters).toContainEqual(['eq', 'member_id', MEMBER_A]);
      expect(client.requests[0].filters).toContainEqual(['gte', 'class_date', '2026-10-01']);
    });

    it('never returns another member\'s row, whoever the policy lets through', async () => {
      const client = fakeClient();

      const result = await adapterOver(client).listOwnConfirmations({
        userId: MEMBER_A,
        fromDate: '2026-10-01',
      });

      expect(result.data.map((row) => row.genreId)).toEqual(['salsa', 'bachata']);
      expect(result.data).toHaveLength(2);
    });

    it('turns the HH:MM:SS the database prints into HH:MM (R4)', async () => {
      const client = fakeClient({
        rows: [{ ...ROWS[0], start_time: '19:00:00', end_time: '20:00:00' }],
      });

      const result = await adapterOver(client).listOwnConfirmations({
        userId: MEMBER_A,
        fromDate: '2026-10-01',
      });

      expect(result.data[0].startTime).toBe('19:00');
      expect(result.data[0].endTime).toBe('20:00');
    });

    it('accepts a time that already is HH:MM', async () => {
      const client = fakeClient({ rows: [{ ...ROWS[0], start_time: '19:00', end_time: '20:00' }] });

      const result = await adapterOver(client).listOwnConfirmations({
        userId: MEMBER_A,
        fromDate: '2026-10-01',
      });

      expect(result.data[0]).toMatchObject({ startTime: '19:00', endTime: '20:00' });
    });

    it.each(['19:00:30', '19:00:00.5', '19:00:01', '7:00', '19', '', null, undefined])(
      'fails instead of slicing a time that is not whole-minute (%s)',
      async (bad) => {
        const client = fakeClient({ rows: [{ ...ROWS[0], start_time: bad }] });

        const result = await adapterOver(client).listOwnConfirmations({
          userId: MEMBER_A,
          fromDate: '2026-10-01',
        });

        expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
      },
    );

    it('fails on a bad end_time the same way', async () => {
      const client = fakeClient({ rows: [{ ...ROWS[0], end_time: '20:00:30' }] });

      const result = await adapterOver(client).listOwnConfirmations({
        userId: MEMBER_A,
        fromDate: '2026-10-01',
      });

      expect(result).toEqual({ ok: false, code: 'UNKNOWN' });
    });
  });

  describe('confirm', () => {
    it('inserts exactly the seven granted columns', async () => {
      const client = fakeClient({ rows: [] });

      const result = await adapterOver(client).confirm(OCCURRENCE);

      expect(result).toEqual({ ok: true, data: null });
      expect(client.requests).toHaveLength(1);
      expect(client.requests[0].operation).toBe('insert');
      expect(client.requests[0].values).toEqual({
        class_date: '2026-10-26',
        start_time: '19:00',
        end_time: '20:00',
        genre_id: 'salsa',
        room_key: 'sala-1',
        genre_name: 'Salsa',
        room_label: 'Sala 1',
      });
    });

    it('sends neither member_id nor starts_at, and asks for no rows back, no upsert', async () => {
      const client = fakeClient({ rows: [] });

      await adapterOver(client).confirm(OCCURRENCE);

      const [request] = client.requests;
      expect(Object.keys(request.values)).not.toContain('member_id');
      expect(Object.keys(request.values)).not.toContain('starts_at');
      expect(request.returning).toBe(false);
      expect(request.extra).toEqual([]);
    });

    it('counts an already-confirmed occurrence (23505) as done', async () => {
      const client = fakeClient({ error: postgrestError('23505') });

      expect(await adapterOver(client).confirm(OCCURRENCE)).toEqual({ ok: true, data: null });
    });

    it('maps a refusal of the policy (42501) to FORBIDDEN, without the error text', async () => {
      const client = fakeClient({ error: postgrestError('42501') });

      const result = await adapterOver(client).confirm(OCCURRENCE);

      expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('cancel', () => {
    it('deletes by the four identity columns and asks for the ids back', async () => {
      const client = fakeClient();

      const result = await adapterOver(client).cancel(OCCURRENCE);

      expect(result).toEqual({ ok: true, data: null });
      const [request] = client.requests;
      expect(request.operation).toBe('delete');
      expect(request.returning).toBe('id');
      expect(request.filters).toEqual([
        ['eq', 'class_date', '2026-10-26'],
        ['eq', 'start_time', '19:00'],
        ['eq', 'genre_id', 'salsa'],
        ['eq', 'room_key', 'sala-1'],
      ]);
      expect(client.table.map((row) => row.id)).not.toContain('c-a1');
    });

    it('reports STARTED when the delete removed no row (the policy hides a started class)', async () => {
      const client = fakeClient({ rows: [] });

      expect(await adapterOver(client).cancel(OCCURRENCE)).toEqual({ ok: false, code: 'STARTED' });
    });

    it('maps a database error through the shared codes', async () => {
      const client = fakeClient({ error: postgrestError('42501') });

      const result = await adapterOver(client).cancel(OCCURRENCE);

      expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('when the client cannot be loaded', () => {
    it('answers NETWORK for every method and never rejects', async () => {
      const adapter = createAttendanceAdapter(async () => {
        throw new TypeError('Failed to fetch dynamically imported module');
      });

      expect(await adapter.listOwnConfirmations({ userId: MEMBER_A, fromDate: '2026-10-01' }))
        .toEqual({ ok: false, code: 'NETWORK' });
      expect(await adapter.confirm(OCCURRENCE)).toEqual({ ok: false, code: 'NETWORK' });
      expect(await adapter.cancel(OCCURRENCE)).toEqual({ ok: false, code: 'NETWORK' });
    });

    it('does not load the client while creating the adapter', () => {
      const getClient = vi.fn();

      createAttendanceAdapter(getClient);

      expect(getClient).not.toHaveBeenCalled();
    });
  });
});
