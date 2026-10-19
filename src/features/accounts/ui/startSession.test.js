import startSession from './startSession';

describe('startSession', () => {
  it('starts the session once when the first attempt works', async () => {
    const session = { start: vi.fn().mockResolvedValue(undefined) };

    await startSession(session);

    expect(session.start).toHaveBeenCalledTimes(1);
  });

  it('tries a second time when the first attempt rejects', async () => {
    const session = {
      start: vi.fn()
        .mockRejectedValueOnce(new Error('store unavailable'))
        .mockResolvedValueOnce(undefined),
    };

    await startSession(session);

    expect(session.start).toHaveBeenCalledTimes(2);
  });

  it('resolves without throwing and stops after two attempts when both reject', async () => {
    const session = { start: vi.fn().mockRejectedValue(new Error('store unavailable')) };

    await expect(startSession(session)).resolves.toBeUndefined();

    expect(session.start).toHaveBeenCalledTimes(2);
  });
});
