import { describe, expect, it } from 'vitest';

import activationGuardPlugin, { findPlaceholders, isProductionActivation } from './activationGuardPlugin';

const FILE = 'src/features/accounts/domain/privacyContacts.js';
const PLACEHOLDERS = { CONTROLLER: '[RESPONSABLE]', CONTACT: '[CONTACTO]' };
const FILLED = { CONTROLLER: 'Academia Expresión Latina S.A.C.', CONTACT: 'privacidad@example.test' };

const LIVE = {
  vercelEnv: 'production',
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabaseKey: 'sb_publishable_x',
};

const guard = (options) => activationGuardPlugin({ file: FILE, values: PLACEHOLDERS, ...options });

describe('findPlaceholders', () => {
  it.each([
    ['[RESPONSABLE]', true],
    ['  [CONTACTO]  ', true],
    ['[Academia S.A.C.]', true],
    ['Academia S.A.C.', false],
    ['privacidad@example.test', false],
    ['Academia [Lima]', false],
    ['', true],
    ['   ', true],
    ['\t\n', true],
  ])('treats %j as a placeholder: %s', (value, expected) => {
    expect(findPlaceholders({ CONTACT: value })).toEqual(expected ? ['CONTACT'] : []);
  });

  it('names every placeholder that is left, in order', () => {
    expect(findPlaceholders(PLACEHOLDERS)).toEqual(['CONTROLLER', 'CONTACT']);
    expect(findPlaceholders({ CONTROLLER: 'Academia S.A.C.', CONTACT: '[CONTACTO]' }))
      .toEqual(['CONTACT']);
  });

  it('counts a value that is not a text as a placeholder, never as filled in', () => {
    expect(findPlaceholders({ CONTROLLER: undefined, CONTACT: null })).toEqual([
      'CONTROLLER',
      'CONTACT',
    ]);
  });
});

describe('isProductionActivation', () => {
  it('holds only for a Vercel production build with the backend configured', () => {
    expect(isProductionActivation(LIVE)).toBe(true);
  });

  it.each([
    ['preview', { vercelEnv: 'preview' }],
    ['development', { vercelEnv: 'development' }],
    ['no Vercel at all', { vercelEnv: undefined }],
    ['an empty variable', { vercelEnv: '' }],
    ['another case', { vercelEnv: 'Production' }],
    ['a backend without a URL', { supabaseUrl: undefined }],
    ['a blank URL', { supabaseUrl: '   ' }],
    ['a backend without a key', { supabaseKey: undefined }],
    ['a blank key', { supabaseKey: '' }],
    ['no backend at all', { supabaseUrl: undefined, supabaseKey: undefined }],
  ])('does not hold for %s', (_name, change) => {
    expect(isProductionActivation({ ...LIVE, ...change })).toBe(false);
  });
});

describe('activationGuardPlugin', () => {
  it('applies to the build only and is named so a build log can identify it', () => {
    expect(guard(LIVE).apply).toBe('build');
    expect(guard(LIVE).name).toBe('expresion-latina:activation-guard');
  });

  it('can always be created, so the dev server and the tests still load the config', () => {
    expect(() => activationGuardPlugin()).not.toThrow();
    expect(() => guard({})).not.toThrow();
  });

  it('fails a production build with the backend on while a placeholder is left', () => {
    expect(() => guard(LIVE).configResolved()).toThrow(/\[RESPONSABLE\]|CONTROLLER/);
  });

  it('names the file to edit and every value that is still a placeholder', () => {
    let message = '';
    try {
      guard(LIVE).configResolved();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain(FILE);
    expect(message).toContain('CONTROLLER');
    expect(message).toContain('CONTACT');
    expect(message).toMatch(/aviso de privacidad|privacy notice/i);
  });

  it('names only the value that is left when the other one is filled in', () => {
    let message = '';
    try {
      guard({ ...LIVE, values: { ...FILLED, CONTACT: '[CONTACTO]' } }).configResolved();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain('CONTACT');
    expect(message).not.toContain('CONTROLLER');
  });

  it('fails a production build with the backend on while a value is blank', () => {
    expect(() => guard({ ...LIVE, values: { ...FILLED, CONTACT: '  ' } }).configResolved())
      .toThrow(/CONTACT/);
    expect(() => guard({ ...LIVE, values: { ...FILLED, CONTROLLER: '' } }).configResolved())
      .toThrow(/CONTROLLER/);
  });

  it('lets a production build with the backend on through once both are filled in', () => {
    expect(() => guard({ ...LIVE, values: FILLED }).configResolved()).not.toThrow();
  });

  it.each([
    ['a preview build', { vercelEnv: 'preview' }],
    ['a local build', { vercelEnv: undefined }],
    ['a production build with the backend off', { supabaseUrl: undefined, supabaseKey: undefined }],
    ['a production build with a blank key', { supabaseKey: ' ' }],
  ])('lets %s through with the placeholders in place', (_name, change) => {
    expect(() => guard({ ...LIVE, ...change }).configResolved()).not.toThrow();
  });
});
