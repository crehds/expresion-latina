import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8'));

describe('vercel.json', () => {
  it('only declares headers, so routing behavior is unchanged', () => {
    expect(Object.keys(config)).toEqual(['headers']);
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
