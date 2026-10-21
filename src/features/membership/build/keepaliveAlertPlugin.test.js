import keepaliveAlertPlugin from './keepaliveAlertPlugin';

// What the build says when it refuses a value, for the test to read.
function refusal(value) {
  try {
    keepaliveAlertPlugin({ value }).configResolved();
  } catch (error) {
    return error.message;
  }
  return '';
}

describe('keepaliveAlertPlugin', () => {
  it('applies to the build only, so the dev server and the tests never refuse a value', () => {
    expect(keepaliveAlertPlugin({}).apply).toBe('build');
    expect(keepaliveAlertPlugin({ value: 'abc' }).apply).toBe('build');
  });

  it('is named so a build log can identify it', () => {
    expect(keepaliveAlertPlugin({}).name).toBe('expresion-latina:keepalive-alert-days');
  });

  it('can always be created, so the dev server and the tests still load the config', () => {
    expect(() => keepaliveAlertPlugin()).not.toThrow();
    expect(() => keepaliveAlertPlugin({})).not.toThrow();
    expect(() => keepaliveAlertPlugin({ value: 'abc' })).not.toThrow();
    expect(() => keepaliveAlertPlugin({ value: null })).not.toThrow();
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['off', 'off'],
    ['OFF', 'OFF'],
    ['one day', '1'],
    ['the default written out', '3'],
    ['a week', '7'],
    ['a year', '365'],
  ])('lets a build through when the variable is %s', (_label, value) => {
    expect(() => keepaliveAlertPlugin({ value }).configResolved()).not.toThrow();
  });

  it.each([
    ['text', 'abc'],
    ['zero', '0'],
    ['negative', '-1'],
    ['signed', '+3'],
    ['fractional', '3.5'],
    ['an exponent', '1e2'],
    ['written with a leading zero', '03'],
    ['written with a space before', ' 3'],
    ['written with a space after', '3 '],
    ['blank', '   '],
    ['a misspelt off', 'offf'],
    ['a number with a unit', '3d'],
    ['beyond what a number holds exactly', '9007199254740992'],
  ])('fails the build, in configResolved, when the variable is %s', (_label, value) => {
    expect(() => keepaliveAlertPlugin({ value }).configResolved())
      .toThrow(/VITE_KEEPALIVE_ALERT_DAYS/);
  });

  it('fails a build whatever the backend is, since it reads the variable and nothing else', () => {
    const plugin = keepaliveAlertPlugin({ value: 'abc' });

    expect(() => plugin.configResolved({ mode: 'production' })).toThrow();
    expect(() => plugin.configResolved()).toThrow();
  });

  it('names the variable, what it may hold and the value it got', () => {
    const message = refusal('abc');

    expect(message).toContain('VITE_KEEPALIVE_ALERT_DAYS');
    expect(message).toContain('"abc"');
    expect(message).toMatch(/whole number of days/);
    expect(message).toMatch(/at least 1/);
    expect(message).toMatch(/digits only/);
    expect(message).toContain('"off"');
    expect(message).toMatch(/unset/);
    expect(message).toMatch(/default of 3 days/);
  });

  it('quotes the value so that an odd one can be seen as it is', () => {
    expect(refusal(' 3')).toContain('" 3"');
    expect(refusal('3\n')).toContain('"3\\n"');
  });

  it('says the same thing for every value, but for the value it quotes', () => {
    const strip = (message, value) => message.replace(JSON.stringify(value), '<value>');

    expect(strip(refusal('abc'), 'abc')).toBe(strip(refusal('0'), '0'));
  });
});
