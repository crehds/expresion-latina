import { isUuid } from './uuid';

describe('isUuid', () => {
  it.each([
    ['a version 4 id', '3b241101-e2bb-4255-8caf-4136c566a962'],
    ['the id the browser checks use', '00000000-0000-4000-8000-000000000000'],
    ['the nil id', '00000000-0000-0000-0000-000000000000'],
    ['capital letters', '3B241101-E2BB-4255-8CAF-4136C566A962'],
  ])('accepts %s', (_label, value) => {
    expect(isUuid(value)).toBe(true);
  });

  // Only the written form the database itself prints is accepted, so a value
  // taken from an address cannot carry anything else into a request.
  it.each([
    ['empty', ''],
    ['a word', 'member-1'],
    ['one digit short', '3b241101-e2bb-4255-8caf-4136c566a96'],
    ['one digit long', '3b241101-e2bb-4255-8caf-4136c566a9622'],
    ['without the hyphens', '3b241101e2bb42558caf4136c566a962'],
    ['between braces', '{3b241101-e2bb-4255-8caf-4136c566a962}'],
    ['a digit that is not hexadecimal', '3b241101-e2bb-4255-8caf-4136c566a96g'],
    ['surrounded by spaces', ' 3b241101-e2bb-4255-8caf-4136c566a962 '],
    ['followed by a new line', '3b241101-e2bb-4255-8caf-4136c566a962\n'],
    ['a path', '../3b241101-e2bb-4255-8caf-4136c566a962'],
    ['two ids', '3b241101-e2bb-4255-8caf-4136c566a9623b241101-e2bb-4255-8caf-4136c566a962'],
  ])('rejects a value that is %s', (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });

  // Some of these would read as an id if they were turned into text first.
  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', {}],
    ['an array holding an id', ['3b241101-e2bb-4255-8caf-4136c566a962']],
    [
      'an object that writes itself as an id',
      { toString: () => '3b241101-e2bb-4255-8caf-4136c566a962' },
    ],
  ])('rejects %s, which is no text', (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
