import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8'));

describe('vercel.json', () => {
  it('only declares headers and rewrites', () => {
    expect(Object.keys(config).sort()).toEqual(['headers', 'rewrites']);
  });

  it('rewrites client routes to index.html but never /assets/ or a path with a dot', () => {
    expect(config.rewrites).toEqual([
      { source: '/((?!assets/)[^.]*)', destination: '/index.html' },
    ]);
  });

  // Approximates path-to-regexp (not installed here) for this group-only source.
  const rewriteMatcher = new RegExp(`^${config.rewrites[0].source}$`);

  it.each([
    ['/', true],
    ['/schedules', true],
    ['/teachers/some-slug', true],
    ['/auth/callback', true],
    ['/assets/index-abc123.js', false],
    ['/assets/', false],
    ['/manifest.json', false],
    ['/logoELico.ico', false],
    ['/some-prefix/assets/index-abc123.js', false],
  ])('rewrite of %s is %s', (path, rewritten) => {
    expect(rewriteMatcher.test(path)).toBe(rewritten);
  });

  it('sets exactly the three security headers on every path', () => {
    expect(config.headers).toEqual([
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]);
  });
});
