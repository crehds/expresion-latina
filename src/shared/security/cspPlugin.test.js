import { describe, expect, it } from 'vitest';

import { buildCsp } from './csp';
import cspPlugin from './cspPlugin';

const HTML = '<!DOCTYPE html><html><head><title>t</title></head><body></body></html>';
const SUPABASE_URL = 'https://abcd1234.supabase.co';

function injectedTags(options) {
  return cspPlugin(options).transformIndexHtml(HTML);
}

describe('cspPlugin', () => {
  it('applies to the build only, so the dev server keeps React Refresh inline preamble', () => {
    expect(cspPlugin({ supabaseUrl: SUPABASE_URL }).apply).toBe('build');
    expect(cspPlugin({}).apply).toBe('build');
  });

  it('is named so a build log can identify it', () => {
    expect(cspPlugin({}).name).toBe('expresion-latina:csp');
  });

  it('injects one CSP meta whose content is exactly the built policy', () => {
    const tags = injectedTags({ supabaseUrl: SUPABASE_URL });

    expect(tags).toHaveLength(1);
    expect(tags[0].tag).toBe('meta');
    expect(tags[0].attrs).toEqual({
      'http-equiv': 'Content-Security-Policy',
      content: buildCsp({ supabaseUrl: SUPABASE_URL }),
    });
  });

  it('carries the Supabase origin in connect-src only when a URL is configured', () => {
    const withUrl = injectedTags({ supabaseUrl: `${SUPABASE_URL}/rest/v1` })[0].attrs.content;
    const without = injectedTags({})[0].attrs.content;

    expect(withUrl).toContain(`connect-src 'self' ${SUPABASE_URL}`);
    expect(withUrl).not.toContain('/rest/v1');
    expect(without).toContain("connect-src 'self'");
    expect(without).not.toContain('supabase');
    expect(without).toBe(buildCsp({}));
  });

  it('treats a blank URL as not configured', () => {
    expect(injectedTags({ supabaseUrl: '  ' })[0].attrs.content).toBe(buildCsp({}));
  });

  it('prepends the tag so it precedes every script and stylesheet in head', () => {
    const [tag] = injectedTags({ supabaseUrl: SUPABASE_URL });

    expect(tag.injectTo).toBe('head-prepend');
  });

  it('fails when the plugin is created with a malformed or non-http(s) URL', () => {
    expect(() => cspPlugin({ supabaseUrl: 'not a url' })).toThrow(/Invalid Supabase URL/);
    expect(() => cspPlugin({ supabaseUrl: 'ftp://abcd1234.supabase.co' })).toThrow(/http or https/);
  });

  it('builds the policy once, when created', () => {
    const plugin = cspPlugin({ supabaseUrl: SUPABASE_URL });

    expect(plugin.transformIndexHtml(HTML)[0].attrs.content)
      .toBe(plugin.transformIndexHtml(HTML)[0].attrs.content);
  });

  it('keeps the policy safe inside a double-quoted HTML attribute', () => {
    const { content } = injectedTags({ supabaseUrl: SUPABASE_URL })[0].attrs;

    expect(content).not.toContain('"');
    expect(content).not.toContain('<');
    expect(content).not.toContain('>');
  });
});
