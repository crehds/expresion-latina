import { MEMBER_SEARCH_LIMIT, createMembershipAdapter } from './membershipAdapter';

const MEMBER_A = '0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90';
const MEMBER_B = '5f3d9c21-8a64-4b7e-b1c0-6e2a9d4f8c13';

// The rows of public.paid_periods as PostgREST returns them, every column.
const PERIOD_ROWS = [
  {
    id: 'period-a1',
    member_id: MEMBER_A,
    starts_on: '2026-08-01',
    ends_on: '2026-08-31',
    recorded_by: 'admin-1',
    created_at: '2026-08-01T15:00:00+00:00',
  },
  {
    id: 'period-b1',
    member_id: MEMBER_B,
    starts_on: '2026-09-15',
    ends_on: '2026-10-14',
    recorded_by: 'admin-1',
    created_at: '2026-09-15T15:00:00+00:00',
  },
  {
    id: 'period-a2',
    member_id: MEMBER_A,
    starts_on: '2026-09-01',
    ends_on: '2026-09-30',
    recorded_by: 'admin-1',
    created_at: '2026-09-01T15:00:00+00:00',
  },
];

// What admin_search_members returns: one row per member, snake_case.
const DIRECTORY_ROWS = [
  {
    id: MEMBER_A,
    full_name: 'Ana Perez',
    email: 'ana@example.test',
    paid_until: '2026-09-30',
    is_active: true,
  },
  {
    id: MEMBER_B,
    full_name: 'Beto Ruiz',
    email: 'beto@example.test',
    paid_until: null,
    is_active: false,
  },
];

// The body PostgREST answers with when a statement fails: the Postgres code, a
// message, details and a hint. It has no HTTP status. The text names a member, an
// email and dates, which no result may repeat.
const postgrestError = (code, message = 'private detail ana@example.test') => ({
  code,
  message,
  details: `Key (member_id)=(${MEMBER_A}) conflicts with existing key [2026-09-15,2026-10-14].`,
  hint: null,
});

const LEAKS = /0b1a4c6e|ana@example|2026-09-15|2026-10-14|private detail|member_id/;

// A small stand-in for the part of PostgREST the adapter talks to. It keeps the
// tables in memory and answers the way PostgREST does where it matters here:
//  - a read returns every row the filters leave, whoever they belong to (the
//    policies of paid_periods let an admin read every member's rows);
//  - a write only answers rows when the request chains .select(), and an UPDATE or
//    a DELETE that matches nothing succeeds with an empty answer;
//  - the column grants refuse a write to any column but the granted ones (42501).
// `requests` logs every statement it ran, in order.
function fakeClient({
  periods = PERIOD_ROWS,
  heartbeat = [],
  directory = DIRECTORY_ROWS,
  error = null,
} = {}) {
  const tables = {
    paid_periods: periods.map((row) => ({ ...row })),
    ops_heartbeat: heartbeat.map((row) => ({ ...row })),
  };
  const grants = {
    paid_periods: { insert: ['member_id', 'starts_on', 'ends_on'], update: ['starts_on', 'ends_on'] },
  };
  const requests = [];
  const rpcCalls = [];

  function run(table, state) {
    requests.push({
      table,
      operation: state.operation,
      values: state.values,
      filters: state.filters,
      columns: state.columns,
      returning: state.returning,
    });
    if (error) {
      return { data: null, error };
    }

    const matching = tables[table].filter((row) => (
      state.filters.every(([column, value]) => row[column] === value)
    ));
    const project = (row) => Object.fromEntries(
      state.columns.map((column) => [column, row[column]]),
    );
    const refused = (operation) => (
      Object.keys(state.values ?? {}).some((column) => !grants[table][operation].includes(column))
    );
    const denied = { data: null, error: postgrestError('42501', 'permission denied for table paid_periods') };

    if (state.operation === 'insert') {
      if (refused('insert')) return denied;
      tables[table].push({ id: `period-${tables[table].length + 1}`, ...state.values });
      return { data: null, error: null };
    }
    if (state.operation === 'update') {
      if (refused('update')) return denied;
      matching.forEach((row) => Object.assign(row, state.values));
      return { data: state.returning ? matching.map(project) : null, error: null };
    }
    if (state.operation === 'delete') {
      tables[table] = tables[table].filter((row) => !matching.includes(row));
      return { data: state.returning ? matching.map(project) : null, error: null };
    }

    const sorted = state.order
      ? [...matching].sort((a, b) => (
        (a[state.order.column] < b[state.order.column] ? -1 : 1) * (state.order.ascending ? 1 : -1)
      ))
      : matching;
    const rows = sorted.map(project);
    return { data: state.single ? (rows[0] ?? null) : rows, error: null };
  }

  function from(table) {
    const state = {
      operation: 'select',
      columns: [],
      filters: [],
      order: null,
      values: null,
      returning: false,
      single: false,
    };
    const builder = {
      select: (columns) => {
        state.columns = columns.split(',').map((column) => column.trim());
        state.returning = state.operation !== 'select';
        return builder;
      },
      insert: (values) => { state.operation = 'insert'; state.values = values; return builder; },
      update: (values) => { state.operation = 'update'; state.values = values; return builder; },
      delete: () => { state.operation = 'delete'; return builder; },
      eq: (column, value) => { state.filters.push([column, value]); return builder; },
      order: (column, { ascending = true } = {}) => {
        state.order = { column, ascending };
        return builder;
      },
      maybeSingle: () => { state.single = true; return builder; },
      then: (resolve, reject) => Promise.resolve(run(table, state)).then(resolve, reject),
    };
    return builder;
  }

  return {
    requests,
    rpcCalls,
    tables,
    from,
    rpc: async (name, args) => {
      rpcCalls.push([name, args]);
      return error ? { data: null, error } : { data: directory, error: null };
    },
  };
}

const adapterFor = (client) => createMembershipAdapter(async () => client);

describe('createMembershipAdapter', () => {
  it('does not ask for the client when it is created', () => {
    const getClient = vi.fn();

    createMembershipAdapter(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  describe('searchMembers', () => {
    it('calls admin_search_members with the query and a page size the database accepts', async () => {
      const client = fakeClient();

      await adapterFor(client).searchMembers('ana');

      expect(client.rpcCalls).toEqual([['admin_search_members', { q: 'ana', lim: MEMBER_SEARCH_LIMIT }]]);
      expect(Number.isInteger(MEMBER_SEARCH_LIMIT)).toBe(true);
      expect(MEMBER_SEARCH_LIMIT).toBeGreaterThanOrEqual(1);
      expect(MEMBER_SEARCH_LIMIT).toBeLessThanOrEqual(200);
    });

    it('sends the query exactly as typed: the database trims it and takes % and _ literally', async () => {
      const client = fakeClient();

      await adapterFor(client).searchMembers('  50%_off ');

      expect(client.rpcCalls[0][1].q).toBe('  50%_off ');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
    ])('asks for the directory with an empty query when the query is %s', async (_label, query) => {
      const client = fakeClient();

      await adapterFor(client).searchMembers(query);

      expect(client.rpcCalls[0][1].q).toBe('');
    });

    it('maps each row to a camelCase member and keeps nothing else', async () => {
      const directory = DIRECTORY_ROWS.map((row) => ({ ...row, consent_at: '2026-01-01', is_admin: false }));

      const result = await adapterFor(fakeClient({ directory })).searchMembers('');

      expect(result).toStrictEqual({
        ok: true,
        data: [
          {
            id: MEMBER_A,
            fullName: 'Ana Perez',
            email: 'ana@example.test',
            paidUntil: '2026-09-30',
            isActive: true,
          },
          {
            id: MEMBER_B,
            fullName: 'Beto Ruiz',
            email: 'beto@example.test',
            paidUntil: null,
            isActive: false,
          },
        ],
      });
    });

    it.each([
      ['an empty list', []],
      ['no data at all', null],
    ])('answers an empty list for %s', async (_label, directory) => {
      const result = await adapterFor(fakeClient({ directory })).searchMembers('nobody');

      expect(result).toStrictEqual({ ok: true, data: [] });
    });

    it.each([
      ['42501', 'FORBIDDEN'],
      ['22023', 'INVALID'],
      ['XX000', 'UNKNOWN'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const result = await adapterFor(fakeClient({ error: postgrestError(code) })).searchMembers('ana');

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('listPeriods', () => {
    it('reads the periods of the member asked for and of no other member, newest first', async () => {
      const result = await adapterFor(fakeClient()).listPeriods(MEMBER_A);

      expect(result).toStrictEqual({
        ok: true,
        data: [
          {
            id: 'period-a2', memberId: MEMBER_A, startsOn: '2026-09-01', endsOn: '2026-09-30',
          },
          {
            id: 'period-a1', memberId: MEMBER_A, startsOn: '2026-08-01', endsOn: '2026-08-31',
          },
        ],
      });
    });

    // The policy of paid_periods lets an admin read every member's rows, so the
    // filter is the only thing that keeps one member's page to that member.
    it('filters by member_id, and by nothing else', async () => {
      const client = fakeClient();

      await adapterFor(client).listPeriods(MEMBER_B);

      expect(client.requests).toHaveLength(1);
      expect(client.requests[0]).toMatchObject({ table: 'paid_periods', operation: 'select' });
      expect(client.requests[0].filters).toEqual([['member_id', MEMBER_B]]);
    });

    it('asks for the four columns it maps, and not recorded_by or created_at', async () => {
      const client = fakeClient();

      await adapterFor(client).listPeriods(MEMBER_A);

      expect(client.requests[0].columns).toEqual(['id', 'member_id', 'starts_on', 'ends_on']);
    });

    it('answers an empty list for a member with no periods', async () => {
      const result = await adapterFor(fakeClient()).listPeriods('00000000-0000-4000-8000-000000000000');

      expect(result).toStrictEqual({ ok: true, data: [] });
    });

    it.each([
      ['42501', 'FORBIDDEN'],
      ['22P02', 'INVALID'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const client = fakeClient({ error: postgrestError(code) });

      const result = await adapterFor(client).listPeriods(MEMBER_A);

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('createPeriod', () => {
    const NEW_PERIOD = { memberId: MEMBER_A, startsOn: '2026-10-01', endsOn: '2026-10-31' };

    it('inserts exactly member_id, starts_on and ends_on', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).createPeriod(NEW_PERIOD);

      expect(result).toStrictEqual({ ok: true, data: null });
      expect(client.requests).toHaveLength(1);
      expect(client.requests[0].operation).toBe('insert');
      expect(client.requests[0].values).toStrictEqual({
        member_id: MEMBER_A,
        starts_on: '2026-10-01',
        ends_on: '2026-10-31',
      });
      expect(client.tables.paid_periods).toHaveLength(PERIOD_ROWS.length + 1);
    });

    it('does not ask for the new row back: the screen reads the list again', async () => {
      const client = fakeClient();

      await adapterFor(client).createPeriod(NEW_PERIOD);

      expect(client.requests[0].returning).toBe(false);
    });

    it('does not send a column the table grants no write on, whatever the caller passes', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).createPeriod({
        ...NEW_PERIOD, id: 'chosen', recordedBy: 'someone', createdAt: '2020-01-01',
      });

      expect(result).toStrictEqual({ ok: true, data: null });
      expect(Object.keys(client.requests[0].values)).toEqual(['member_id', 'starts_on', 'ends_on']);
    });

    it.each([
      ['23P01', 'OVERLAP'],
      ['23514', 'INVALID'],
      ['42501', 'FORBIDDEN'],
      ['23505', 'UNKNOWN'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const client = fakeClient({ error: postgrestError(code) });

      const result = await adapterFor(client).createPeriod(NEW_PERIOD);

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('updatePeriod', () => {
    it('changes starts_on and ends_on of the one row and nothing else', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).updatePeriod('period-a1', {
        startsOn: '2026-08-05', endsOn: '2026-09-04',
      });

      expect(result).toStrictEqual({ ok: true, data: null });
      expect(client.requests[0].operation).toBe('update');
      expect(client.requests[0].values).toStrictEqual({ starts_on: '2026-08-05', ends_on: '2026-09-04' });
      expect(client.requests[0].filters).toEqual([['id', 'period-a1']]);
      expect(client.tables.paid_periods.find((row) => row.id === 'period-a1')).toMatchObject({
        member_id: MEMBER_A, starts_on: '2026-08-05', ends_on: '2026-09-04',
      });
      expect(client.tables.paid_periods.find((row) => row.id === 'period-a2')).toMatchObject({
        starts_on: '2026-09-01', ends_on: '2026-09-30',
      });
    });

    it('asks for the id of the rows it changed, which is how it knows a row matched', async () => {
      const client = fakeClient();

      await adapterFor(client).updatePeriod('period-a1', { startsOn: '2026-08-05', endsOn: '2026-09-04' });

      expect(client.requests[0].returning).toBe(true);
      expect(client.requests[0].columns).toEqual(['id']);
    });

    // An UPDATE that matches no row (it was deleted meanwhile, or the policy hides
    // it) is a success with no rows for PostgREST, not an error.
    it('answers NOT_FOUND when no row matched', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).updatePeriod('period-gone', {
        startsOn: '2026-08-05', endsOn: '2026-09-04',
      });

      expect(result).toStrictEqual({ ok: false, code: 'NOT_FOUND' });
      expect(client.tables.paid_periods).toEqual(PERIOD_ROWS);
    });

    it.each([
      ['23P01', 'OVERLAP'],
      ['23514', 'INVALID'],
      ['42501', 'FORBIDDEN'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const result = await adapterFor(fakeClient({ error: postgrestError(code) }))
        .updatePeriod('period-a1', { startsOn: '2026-08-05', endsOn: '2026-09-04' });

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('deletePeriod', () => {
    it('deletes the one row', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).deletePeriod('period-a1');

      expect(result).toStrictEqual({ ok: true, data: null });
      expect(client.requests[0].operation).toBe('delete');
      expect(client.requests[0].filters).toEqual([['id', 'period-a1']]);
      expect(client.tables.paid_periods.map((row) => row.id)).toEqual(['period-b1', 'period-a2']);
    });

    it('asks for the id of the rows it deleted, which is how it knows a row matched', async () => {
      const client = fakeClient();

      await adapterFor(client).deletePeriod('period-a1');

      expect(client.requests[0].returning).toBe(true);
      expect(client.requests[0].columns).toEqual(['id']);
    });

    it('answers NOT_FOUND when no row matched, and deletes nothing', async () => {
      const client = fakeClient();

      const result = await adapterFor(client).deletePeriod('period-gone');

      expect(result).toStrictEqual({ ok: false, code: 'NOT_FOUND' });
      expect(client.tables.paid_periods).toEqual(PERIOD_ROWS);
    });

    it.each([
      ['42501', 'FORBIDDEN'],
      ['22P02', 'INVALID'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const result = await adapterFor(fakeClient({ error: postgrestError(code) })).deletePeriod('period-a1');

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('getLastPing', () => {
    it('reads last_ping_at of the single heartbeat row and answers the instant as the database wrote it', async () => {
      const client = fakeClient({ heartbeat: [{ id: 1, last_ping_at: '2026-10-19T12:00:03.123456+00:00' }] });

      const result = await adapterFor(client).getLastPing();

      expect(result).toStrictEqual({ ok: true, data: '2026-10-19T12:00:03.123456+00:00' });
      expect(client.requests[0]).toMatchObject({ table: 'ops_heartbeat', operation: 'select' });
      expect(client.requests[0].columns).toEqual(['last_ping_at']);
      expect(client.requests[0].filters).toEqual([['id', 1]]);
    });

    // Nothing has pinged yet, or the policy hides the row from a member who is not
    // an admin: both answer success with no row.
    it('answers null when there is no heartbeat row', async () => {
      const result = await adapterFor(fakeClient({ heartbeat: [] })).getLastPing();

      expect(result).toStrictEqual({ ok: true, data: null });
    });

    it.each([
      ['42501', 'FORBIDDEN'],
      ['XX000', 'UNKNOWN'],
    ])('maps the PostgREST code %s to %s and repeats nothing of the error', async (code, expected) => {
      const result = await adapterFor(fakeClient({ error: postgrestError(code) })).getLastPing();

      expect(result).toStrictEqual({ ok: false, code: expected });
      expect(JSON.stringify(result)).not.toMatch(LEAKS);
    });
  });

  describe('when the client cannot be obtained', () => {
    const methods = [
      ['searchMembers', (adapter) => adapter.searchMembers('ana')],
      ['listPeriods', (adapter) => adapter.listPeriods(MEMBER_A)],
      ['createPeriod', (adapter) => adapter.createPeriod({
        memberId: MEMBER_A, startsOn: '2026-10-01', endsOn: '2026-10-31',
      })],
      ['updatePeriod', (adapter) => adapter.updatePeriod('period-a1', {
        startsOn: '2026-08-05', endsOn: '2026-09-04',
      })],
      ['deletePeriod', (adapter) => adapter.deletePeriod('period-a1')],
      ['getLastPing', (adapter) => adapter.getLastPing()],
    ];

    it.each(methods)('%s resolves to NETWORK when the dynamic import fails', async (_name, call) => {
      const adapter = createMembershipAdapter(
        () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      );

      await expect(call(adapter)).resolves.toStrictEqual({ ok: false, code: 'NETWORK' });
    });

    it.each(methods)('%s resolves to UNKNOWN for any other failure and never throws', async (_name, call) => {
      const adapter = createMembershipAdapter(
        () => Promise.reject(new Error('The backend is not configured')),
      );

      await expect(call(adapter)).resolves.toStrictEqual({ ok: false, code: 'UNKNOWN' });
    });
  });
});
