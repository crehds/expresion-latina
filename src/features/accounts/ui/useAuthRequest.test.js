import { act, renderHook } from '@testing-library/react';
import useAuthRequest from './useAuthRequest';

const ok = (data = null) => ({ ok: true, data });
const fail = (code) => ({ ok: false, code });

// An action that stays pending until the test lets it finish.
function pendingAction(result) {
  let release;
  const action = vi.fn(() => new Promise((resolve) => { release = () => resolve(result); }));
  return { action, release: () => release() };
}

describe('useAuthRequest', () => {
  it('starts idle, with no error', () => {
    const { result } = renderHook(() => useAuthRequest());

    expect(result.current.busy).toBe(false);
    expect(result.current.errorCode).toBeNull();
  });

  it('is busy while the action runs, idle after it, and hands back the result', async () => {
    const { result } = renderHook(() => useAuthRequest());
    const { action, release } = pendingAction(ok('done'));

    let outcome;
    act(() => { outcome = result.current.run(action); });
    expect(result.current.busy).toBe(true);
    await act(async () => { release(); await outcome; });

    expect(result.current.busy).toBe(false);
    expect(result.current.errorCode).toBeNull();
    await expect(outcome).resolves.toEqual(ok('done'));
  });

  it('keeps the code of a failed result and hands the result back', async () => {
    const { result } = renderHook(() => useAuthRequest());

    let outcome;
    await act(async () => { outcome = await result.current.run(async () => fail('RATE_LIMITED')); });

    expect(result.current.errorCode).toBe('RATE_LIMITED');
    expect(result.current.busy).toBe(false);
    expect(outcome).toEqual(fail('RATE_LIMITED'));
  });

  it('turns a rejected action into UNKNOWN and is idle again', async () => {
    const { result } = renderHook(() => useAuthRequest());

    let outcome;
    await act(async () => {
      outcome = await result.current.run(async () => { throw new Error('raw failure ana@example.test'); });
    });

    expect(result.current.errorCode).toBe('UNKNOWN');
    expect(result.current.busy).toBe(false);
    expect(outcome).toEqual(fail('UNKNOWN'));
    expect(JSON.stringify(outcome)).not.toMatch(/raw failure|ana@example/);
  });

  it('forgets the previous error as soon as a new call starts', async () => {
    const { result } = renderHook(() => useAuthRequest());
    await act(async () => { await result.current.run(async () => fail('NETWORK')); });
    expect(result.current.errorCode).toBe('NETWORK');
    const { action, release } = pendingAction(ok());

    let outcome;
    act(() => { outcome = result.current.run(action); });
    expect(result.current.errorCode).toBeNull();
    await act(async () => { release(); await outcome; });

    expect(result.current.errorCode).toBeNull();
  });

  it('drops the error on clear', async () => {
    const { result } = renderHook(() => useAuthRequest());
    await act(async () => { await result.current.run(async () => fail('NETWORK')); });

    act(() => { result.current.clear(); });

    expect(result.current.errorCode).toBeNull();
  });

  it('keeps run and clear stable across renders', async () => {
    const { result, rerender } = renderHook(() => useAuthRequest());
    const { run, clear } = result.current;

    await act(async () => { await result.current.run(async () => fail('NETWORK')); });
    rerender();

    expect(result.current.run).toBe(run);
    expect(result.current.clear).toBe(clear);
  });
});
