import {
  isActiveOn, paidUntil, defaultStart, endAfter,
} from './rules';

function period(startsOn, endsOn) {
  return { startsOn, endsOn };
}

describe('isActiveOn', () => {
  const TODAY = '2026-09-27';

  it('is active on the start day', () => {
    expect(isActiveOn([period('2026-09-27', '2026-10-27')], TODAY)).toBe(true);
  });

  it('is active on the end day', () => {
    expect(isActiveOn([period('2026-08-27', '2026-09-27')], TODAY)).toBe(true);
  });

  it('is inactive the day before the start', () => {
    expect(isActiveOn([period('2026-09-28', '2026-10-28')], TODAY)).toBe(false);
  });

  // "Period ends": the member's only paid period ended yesterday, so today
  // they must read as inactive.
  it('is inactive the day after the end', () => {
    expect(isActiveOn([period('2026-08-27', '2026-09-26')], TODAY)).toBe(false);
  });

  it('is active when any one of several periods covers the date', () => {
    const periods = [
      period('2026-01-01', '2026-01-31'),
      period('2026-09-01', '2026-09-30'),
      period('2027-01-01', '2027-01-31'),
    ];

    expect(isActiveOn(periods, TODAY)).toBe(true);
  });

  it('is inactive for an empty list', () => {
    expect(isActiveOn([], TODAY)).toBe(false);
  });
});

describe('paidUntil', () => {
  it('is the latest endsOn across past, current and future periods', () => {
    const periods = [
      period('2026-01-01', '2026-01-31'),
      period('2026-09-01', '2026-09-30'),
      period('2026-12-01', '2026-12-31'),
    ];

    expect(paidUntil(periods)).toBe('2026-12-31');
  });

  it('is null for an empty list', () => {
    expect(paidUntil([])).toBeNull();
  });
});

describe('defaultStart', () => {
  const TODAY = '2026-09-27';

  // "Renewal keeps no days": a renewal must not re-pay days already
  // covered by the still-active period.
  it('is the day after an active period that ends in 5 days', () => {
    const periods = [period('2026-09-01', '2026-10-02')];

    expect(defaultStart(periods, TODAY)).toBe('2026-10-03');
  });

  it('is tomorrow when the only period ends today', () => {
    const periods = [period('2026-09-01', TODAY)];

    expect(defaultStart(periods, TODAY)).toBe('2026-09-28');
  });

  it('is today when every period has already expired', () => {
    const periods = [period('2026-01-01', '2026-01-31')];

    expect(defaultStart(periods, TODAY)).toBe(TODAY);
  });

  it('is the day after a future, already-prepaid period', () => {
    const periods = [
      period('2026-08-01', '2026-08-31'),
      period('2026-11-01', '2026-11-30'),
    ];

    expect(defaultStart(periods, TODAY)).toBe('2026-12-01');
  });

  it('is today when there are no periods at all', () => {
    expect(defaultStart([], TODAY)).toBe(TODAY);
  });
});

describe('endAfter', () => {
  it.each([
    ['2026-01-15', 1, '2026-02-14'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2028-02-29', 12, '2029-02-28'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-09-28', 12, '2027-09-27'],
  ])('starting %s for %i month(s) ends %s', (start, months, expected) => {
    expect(endAfter(start, { months })).toBe(expected);
  });

  it('propagates the invalid-months rejection from anniversary', () => {
    expect(() => endAfter('2026-01-15', { months: 0 })).toThrow();
  });
});
