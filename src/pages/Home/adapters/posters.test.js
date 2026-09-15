import createAdaptedPoster from './posters';

describe('createAdaptedPoster', () => {
  it('adapts a complete record', () => {
    expect(createAdaptedPoster({
      _id: 'abc',
      originalname: 'casting.jpg',
      mimetype: 'image/jpeg',
      size: 1234,
      publicUrl: { value: 'https://cdn.example/casting.jpg' },
    })).toEqual({
      id: 'abc',
      filename: 'casting.jpg',
      url: 'https://cdn.example/casting.jpg',
    });
  });

  it('accepts publicUrl as a bare string', () => {
    expect(createAdaptedPoster({ _id: 'a', publicUrl: 'https://cdn.example/a.jpg' }))
      .toMatchObject({ url: 'https://cdn.example/a.jpg' });
  });

  it('falls back to a filename when the record has no original name', () => {
    expect(createAdaptedPoster({ _id: 'a', publicUrl: 'https://cdn.example/a.jpg' }).filename)
      .toBe('Poster');
  });

  // These three all threw "Cannot destructure property 'value' of undefined"
  // before, taking the whole home page down with them.
  it.each([
    ['an empty record', {}],
    ['a null publicUrl', { _id: 'a', publicUrl: null }],
    ['a publicUrl with no value', { _id: 'a', publicUrl: {} }],
    ['a blank url', { _id: 'a', publicUrl: { value: '   ' } }],
    ['null', null],
    ['a non-object', 'nope'],
  ])('returns null for %s instead of throwing', (_label, input) => {
    expect(createAdaptedPoster(input)).toBeNull();
  });
});
