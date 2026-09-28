import { todayInLima, addDays, anniversary } from './limaCalendar';

describe('todayInLima', () => {
  // America/Lima is a fixed UTC-05:00 with no DST, so UTC midnight is still
  // 19:00 the previous day in Lima -- the boundary a naive
  // `now.toISOString().slice(0, 10)` would get wrong every single day.
  it.each([
    ['2026-09-28T00:00:00Z', '2026-09-27'],
    ['2026-09-28T04:59:59.999Z', '2026-09-27'],
    ['2026-09-28T05:00:00.000Z', '2026-09-28'],
  ])('%s is still %s in Lima', (instant, expected) => {
    expect(todayInLima(new Date(instant))).toBe(expected);
  });

  it('crosses a year boundary the same way', () => {
    expect(todayInLima(new Date('2027-01-01T04:00:00Z'))).toBe('2026-12-31');
  });

  it('rejects an invalid Date', () => {
    expect(() => todayInLima(new Date('not-a-date'))).toThrow();
  });

  it('rejects a value that is not a Date at all', () => {
    expect(() => todayInLima('2026-09-28T00:00:00Z')).toThrow();
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('reaches 29 Feb in a leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('crosses out of 29 Feb in a leap year', () => {
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('subtracts across a month end', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('subtracts across a year end', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('rejects a malformed ISO date', () => {
    expect(() => addDays('not-a-date', 1)).toThrow();
  });

  it('rejects an impossible calendar date', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });

  it('rejects a non-integer day count', () => {
    expect(() => addDays('2026-01-01', 1.5)).toThrow();
  });
});

describe('anniversary', () => {
  it('keeps the day of month when it exists in the target month', () => {
    expect(anniversary('2026-01-15', 1)).toBe('2026-02-15');
  });

  // Design D3 rejects "clamp, then -1 day": clamping 31 Jan to 28 Feb and
  // subtracting a day would turn it into 27 Feb, one day short of the month
  // the member paid for. Rolling forward to 1 Mar instead keeps endAfter
  // (anniversary - 1 day) landing on the real last day of February.
  it('rolls a missing day forward to the 1st of the next month, rather than clamping', () => {
    expect(anniversary('2026-01-31', 1)).toBe('2026-03-01');
  });

  it('rolls forward again when the next month is also too short', () => {
    expect(anniversary('2026-03-31', 1)).toBe('2026-05-01');
  });

  it('carries the roll-forward across a year boundary', () => {
    expect(anniversary('2028-02-29', 12)).toBe('2029-03-01');
  });

  it('rolls forward in a leap year whose target month is one day short', () => {
    expect(anniversary('2028-01-31', 1)).toBe('2028-03-01');
  });

  it('rejects a malformed ISO date', () => {
    expect(() => anniversary('not-a-date', 1)).toThrow();
  });

  it('rejects an impossible calendar date', () => {
    expect(() => anniversary('2026-02-30', 1)).toThrow();
  });

  it.each([0, -1, 1.5, 'two'])('rejects a non-positive-integer month count (%s)', (months) => {
    expect(() => anniversary('2026-01-15', months)).toThrow();
  });
});
