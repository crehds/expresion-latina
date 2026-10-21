import { validatePeriod } from './periodValidation';

const VALID = { startsOn: '2026-10-01', endsOn: '2026-10-31' };

const errorsFor = (overrides) => validatePeriod({ ...VALID, ...overrides }).errors;

const BLANK = [
  ['empty', ''],
  ['only spaces', '   '],
  ['a tab and a newline', '\t\n'],
  ['missing', undefined],
  ['null', null],
  ['not a string', 20261001],
];

const MALFORMED = [
  ['a day first', '01-10-2026'],
  ['slashes', '2026/10/01'],
  ['single digits', '2026-1-1'],
  ['an instant', '2026-10-01T00:00:00Z'],
  ['a padded date', ' 2026-10-01'],
  ['a year of six digits, as a date input can hold', '275760-09-13'],
  ['words', 'next month'],
];

const IMPOSSIBLE = [
  ['30 February', '2026-02-30'],
  ['29 February in a common year', '2027-02-29'],
  ['month 13', '2026-13-01'],
];

describe('validatePeriod', () => {
  it('accepts a start and an end that are real dates in order', () => {
    expect(validatePeriod(VALID)).toEqual({ valid: true, errors: {} });
  });

  it('accepts a one-day period: the end may be the start', () => {
    expect(validatePeriod({ startsOn: '2026-10-01', endsOn: '2026-10-01' }))
      .toEqual({ valid: true, errors: {} });
  });

  it('accepts a period in the past, in the present or in the future', () => {
    // The form does not know what day it is: only the dates in order matter.
    expect(validatePeriod({ startsOn: '2019-01-01', endsOn: '2019-01-31' }).valid).toBe(true);
    expect(validatePeriod({ startsOn: '2041-01-01', endsOn: '2041-01-31' }).valid).toBe(true);
  });

  it('accepts a period that crosses a month, a year and a leap day', () => {
    expect(validatePeriod({ startsOn: '2027-12-15', endsOn: '2028-02-29' }).valid).toBe(true);
  });

  describe('startsOn', () => {
    it.each(BLANK)('is required when it is %s', (_label, startsOn) => {
      expect(errorsFor({ startsOn })).toEqual({ startsOn: 'required' });
    });

    it.each([...MALFORMED, ...IMPOSSIBLE])('is invalid when it is %s', (_label, startsOn) => {
      expect(errorsFor({ startsOn })).toEqual({ startsOn: 'invalid' });
    });
  });

  describe('endsOn', () => {
    it.each(BLANK)('is required when it is %s', (_label, endsOn) => {
      expect(errorsFor({ endsOn })).toEqual({ endsOn: 'required' });
    });

    it.each([...MALFORMED, ...IMPOSSIBLE])('is invalid when it is %s', (_label, endsOn) => {
      expect(errorsFor({ endsOn })).toEqual({ endsOn: 'invalid' });
    });

    it('is before the start when it is one day earlier', () => {
      expect(errorsFor({ startsOn: '2026-10-02', endsOn: '2026-10-01' }))
        .toEqual({ endsOn: 'before_start' });
    });

    it('is before the start across a month and a year', () => {
      expect(errorsFor({ startsOn: '2026-03-01', endsOn: '2026-02-28' }))
        .toEqual({ endsOn: 'before_start' });
      expect(errorsFor({ startsOn: '2027-01-01', endsOn: '2026-12-31' }))
        .toEqual({ endsOn: 'before_start' });
    });
  });

  describe('when both fields are wrong', () => {
    it('reports each of them under its own key', () => {
      expect(validatePeriod({ startsOn: '', endsOn: '2026-02-30' })).toEqual({
        valid: false,
        errors: { startsOn: 'required', endsOn: 'invalid' },
      });
    });

    it('compares the end with the start only when both can be read', () => {
      // The end cannot be "before" a start that is not a date, and an end that is
      // not a date has no order to speak of.
      expect(errorsFor({ startsOn: '', endsOn: '2026-10-01' })).toEqual({ startsOn: 'required' });
      expect(errorsFor({ startsOn: '2026-10-02', endsOn: 'soon' })).toEqual({ endsOn: 'invalid' });
      expect(errorsFor({ startsOn: '2026-02-30', endsOn: '2026-01-01' }))
        .toEqual({ startsOn: 'invalid' });
    });
  });

  it('is not valid when there is anything to correct', () => {
    expect(validatePeriod({ ...VALID, endsOn: '' }).valid).toBe(false);
  });

  it('asks for both dates when it is given nothing', () => {
    expect(validatePeriod()).toEqual({
      valid: false,
      errors: { startsOn: 'required', endsOn: 'required' },
    });
    expect(validatePeriod({})).toEqual(validatePeriod());
  });

  it('returns keys only, never the typed values or any copy', () => {
    const { errors } = validatePeriod({ startsOn: '2026-13-45', endsOn: 'private note' });

    expect(JSON.stringify(errors)).not.toMatch(/2026|private note/);
    expect(Object.values(errors).every((key) => /^[a-z_]+$/.test(key))).toBe(true);
  });
});
