import { buildCsp } from './csp';

const BASE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  'frame-src https://www.google.com',
];
const TAIL = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const expected = (connectSrc) => [...BASE, connectSrc, ...TAIL].join('; ');

const directive = (csp, name) => csp
  .split('; ')
  .find((part) => part.startsWith(`${name} `));

describe('buildCsp', () => {
  it('produces the exact policy without a Supabase URL', () => {
    expect(buildCsp({ supabaseUrl: undefined })).toBe(
      "default-src 'self'; script-src 'self'; "
      + "style-src 'self' https://fonts.googleapis.com; "
      + "font-src 'self' https://fonts.gstatic.com data:; "
      + "img-src 'self' data:; frame-src https://www.google.com; "
      + "connect-src 'self'; object-src 'none'; base-uri 'self'; "
      + "form-action 'self'",
    );
  });

  it('produces the exact policy with a Supabase URL', () => {
    expect(buildCsp({ supabaseUrl: 'https://abc.supabase.co' })).toBe(
      "default-src 'self'; script-src 'self'; "
      + "style-src 'self' https://fonts.googleapis.com; "
      + "font-src 'self' https://fonts.gstatic.com data:; "
      + "img-src 'self' data:; frame-src https://www.google.com; "
      + "connect-src 'self' https://abc.supabase.co; object-src 'none'; "
      + "base-uri 'self'; form-action 'self'",
    );
  });

  it('works with no argument at all', () => {
    expect(buildCsp()).toBe(expected("connect-src 'self'"));
  });

  it.each([undefined, null, '', '   ', '\t\n'])(
    'treats %j as not configured',
    (supabaseUrl) => {
      expect(directive(buildCsp({ supabaseUrl }), 'connect-src'))
        .toBe("connect-src 'self'");
    },
  );

  it('keeps only the origin of a URL with a path', () => {
    expect(buildCsp({ supabaseUrl: 'https://abc.supabase.co/rest/v1/' }))
      .toBe(expected("connect-src 'self' https://abc.supabase.co"));
  });

  it('drops the query, the hash and any credentials', () => {
    const csp = buildCsp({
      supabaseUrl: 'https://user:pw@abc.supabase.co/x?y=1#z',
    });
    expect(directive(csp, 'connect-src'))
      .toBe("connect-src 'self' https://abc.supabase.co");
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(directive(buildCsp({ supabaseUrl: '  https://abc.supabase.co  ' }), 'connect-src'))
      .toBe("connect-src 'self' https://abc.supabase.co");
  });

  it('keeps the port of the local development origin', () => {
    expect(directive(buildCsp({ supabaseUrl: 'http://127.0.0.1:54321' }), 'connect-src'))
      .toBe("connect-src 'self' http://127.0.0.1:54321");
  });

  it('drops a default port, which the origin never carries', () => {
    expect(directive(buildCsp({ supabaseUrl: 'https://abc.supabase.co:443/' }), 'connect-src'))
      .toBe("connect-src 'self' https://abc.supabase.co");
  });

  it.each([
    'not a url',
    'abc.supabase.co',
    '//abc.supabase.co',
    'ftp://abc.supabase.co',
    // Built from parts only to satisfy eslint no-script-url; the input is a real javascript: URL.
    `${'java'}script:alert(1)`,
    'wss://abc.supabase.co',
    'data:text/plain,hi',
  ])('throws on the invalid URL %j', (supabaseUrl) => {
    expect(() => buildCsp({ supabaseUrl })).toThrow();
  });

  it('never allows the Realtime websocket origin (an https source never matches wss)', () => {
    const connectSrc = directive(buildCsp({ supabaseUrl: 'https://abc.supabase.co' }), 'connect-src');

    expect(connectSrc).not.toContain('wss:');
    expect(connectSrc).not.toContain('ws:');
  });

  it('throws on a non-string URL', () => {
    expect(() => buildCsp({ supabaseUrl: 42 })).toThrow();
  });

  it("never lets script-src carry anything but 'self'", () => {
    [undefined, 'https://abc.supabase.co', 'http://127.0.0.1:54321'].forEach((supabaseUrl) => {
      const csp = buildCsp({ supabaseUrl });
      expect(directive(csp, 'script-src')).toBe("script-src 'self'");
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
    });
  });

  it('has no trailing semicolon or separator', () => {
    const csp = buildCsp({ supabaseUrl: 'https://abc.supabase.co' });
    expect(csp.endsWith("form-action 'self'")).toBe(true);
    expect(csp).not.toMatch(/;\s*$/);
  });
});
