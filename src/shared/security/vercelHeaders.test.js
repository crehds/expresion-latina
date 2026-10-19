import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8'));

describe('vercel.json', () => {
  it('only declares headers and rewrites', () => {
    expect(Object.keys(config).sort()).toEqual(['headers', 'rewrites']);
  });

  it('rewrites every path that matches no file to index.html so deep links work', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
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
