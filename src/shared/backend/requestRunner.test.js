import { createRequestRunner } from './requestRunner';

const CLIENT = { name: 'fake supabase client' };

// What PostgREST answers with when a statement fails: the Postgres code plus a
// body that can name people, ids and dates. It has no HTTP status.
const postgrestError = (code, extra = {}) => ({
  code,
  message: 'private detail ana@example.test',
  details: 'Key (member_id)=(0b1a4c6e-7d52-4f0a-9d3e-2c5f8a1b7e90) conflicts with [2026-10-01,2026-10-31]',
  hint: null,
  ...extra,
});

const answering = (answer) => vi.fn(async () => answer);

describe('createRequestRunner', () => {
  it('does not ask for the client when the runner is created', () => {
    const getClient = vi.fn(async () => CLIENT);

    createRequestRunner(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  describe('when the call succeeds', () => {
    it('asks for the client once per call and hands it to the call', async () => {
      const getClient = vi.fn(async () => CLIENT);
      const call = answering({ data: 'row', error: null });
      const run = createRequestRunner(getClient);

      await run(call, (data) => data);
      await run(call, (data) => data);

      expect(getClient).toHaveBeenCalledTimes(2);
      expect(call).toHaveBeenNthCalledWith(1, CLIENT);
      expect(call).toHaveBeenNthCalledWith(2, CLIENT);
    });

    it('answers ok with what read makes of the data', async () => {
      const run = createRequestRunner(async () => CLIENT);

      const result = await run(answering({ data: { full_name: 'Ana' }, error: null }), (row) => row.full_name);

      expect(result).toEqual({ ok: true, data: 'Ana' });
    });

    it('hands read the data exactly as the call returned it, null included', async () => {
      const run = createRequestRunner(async () => CLIENT);
      const read = vi.fn(() => 'nobody');

      const result = await run(answering({ data: null, error: null }), read);

      expect(read).toHaveBeenCalledWith(null);
      expect(result).toEqual({ ok: true, data: 'nobody' });
    });
  });

  describe('when the call returns an error', () => {
    it('answers the code of the error and nothing else of it', async () => {
      const run = createRequestRunner(async () => CLIENT);
      const read = vi.fn();

      const result = await run(answering({ data: null, error: postgrestError('42501') }), read);

      expect(result).toStrictEqual({ ok: false, code: 'FORBIDDEN' });
      expect(JSON.stringify(result)).not.toMatch(/ana@example|member_id|2026-10|private detail/);
      expect(read).not.toHaveBeenCalled();
    });

    it.each([
      ['23P01', 'OVERLAP'],
      ['22023', 'INVALID'],
      ['P0002', 'NOT_FOUND'],
      ['23505', 'UNKNOWN'],
    ])('maps the PostgREST code %s to %s', async (code, expected) => {
      const run = createRequestRunner(async () => CLIENT);

      const result = await run(answering({ data: null, error: postgrestError(code) }), () => null);

      expect(result).toStrictEqual({ ok: false, code: expected });
    });

    it('does not let data next to an error turn the call into a success', async () => {
      const run = createRequestRunner(async () => CLIENT);

      const result = await run(
        answering({ data: [{ id: 'row-1' }], error: postgrestError('42501') }),
        (rows) => rows,
      );

      expect(result).toStrictEqual({ ok: false, code: 'FORBIDDEN' });
    });
  });

  describe('when something throws', () => {
    it('answers NETWORK for a failed dynamic import of the client', async () => {
      const call = vi.fn();
      const run = createRequestRunner(
        () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      );

      const result = await run(call, () => null);

      expect(result).toStrictEqual({ ok: false, code: 'NETWORK' });
      expect(call).not.toHaveBeenCalled();
    });

    it('answers UNKNOWN for any other failure to get the client', async () => {
      const run = createRequestRunner(() => Promise.reject(new Error('The backend is not configured')));

      const result = await run(vi.fn(), () => null);

      expect(result).toStrictEqual({ ok: false, code: 'UNKNOWN' });
    });

    it('answers a code when the call itself throws', async () => {
      const run = createRequestRunner(async () => CLIENT);

      const offline = await run(async () => { throw new TypeError('Failed to fetch'); }, () => null);
      const broken = await run(async () => { throw new Error('boom ana@example.test'); }, () => null);

      expect(offline).toStrictEqual({ ok: false, code: 'NETWORK' });
      expect(broken).toStrictEqual({ ok: false, code: 'UNKNOWN' });
    });

    it('answers a code, and does not throw, when read cannot make sense of the data', async () => {
      const run = createRequestRunner(async () => CLIENT);

      const result = await run(answering({ data: null, error: null }), (row) => row.id);

      expect(result.ok).toBe(false);
      expect(typeof result.code).toBe('string');
      expect(Object.keys(result)).toEqual(['ok', 'code']);
    });
  });

  it('keeps one failed call from affecting the next one', async () => {
    const getClient = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue(CLIENT);
    const run = createRequestRunner(getClient);

    const first = await run(answering({ data: 1, error: null }), (data) => data);
    const second = await run(answering({ data: 2, error: null }), (data) => data);

    expect(first).toStrictEqual({ ok: false, code: 'NETWORK' });
    expect(second).toStrictEqual({ ok: true, data: 2 });
  });
});
