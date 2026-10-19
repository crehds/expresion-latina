// Ties the Auth email templates to the app: the links they build must be the
// ones the confirmation page reads, and nothing in them may send the member
// anywhere the app did not choose. Templates are plain files that only the Auth
// service renders, so this reads them as text.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_CONFIRM_PATH } from './authRedirect';

const ROOT = path.resolve(__dirname, '../../../..');
const CONFIG = readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');

const TEMPLATES = [
  {
    name: 'confirmation',
    type: 'email',
    subject: 'Confirma tu cuenta de Expresión Latina',
    button: 'Confirmar mi correo',
  },
  {
    name: 'recovery',
    type: 'recovery',
    subject: 'Restablece tu contraseña de Expresión Latina',
    button: 'Restablecer mi contraseña',
  },
];

const read = (name) => readFileSync(path.join(ROOT, `supabase/templates/${name}.html`), 'utf8');

// The lines of the `[auth.email.template.<name>]` table, up to the next table.
function tableOf(name) {
  const lines = CONFIG.split(/\r?\n/);
  const start = lines.indexOf(`[auth.email.template.${name}]`);
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('['));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

describe.each(TEMPLATES)('the $name email template', ({
  name, type, subject, button,
}) => {
  const link = `{{ .SiteURL }}${AUTH_CONFIRM_PATH}?token_hash={{ .TokenHash }}&amp;type=${type}`;

  it('is wired in supabase/config.toml with its subject and its file', () => {
    const table = tableOf(name);

    expect(table).not.toBeNull();
    expect(table).toContain(`subject = "${subject}"`);
    expect(table).toContain(`content_path = "./supabase/templates/${name}.html"`);
    expect(existsSync(path.join(ROOT, `supabase/templates/${name}.html`))).toBe(true);
  });

  it('links to the confirmation page with the token hash and the type, and no other parameter', () => {
    const html = read(name);

    expect(html).toContain(`href="${link}"`);
    // The same address again as visible text, to copy when the button fails.
    expect(html.split(link).length - 1).toBe(2);
    expect(html).not.toMatch(/token_hash=[^&]*&amp;(?!type=)/);
  });

  it.each(['.ConfirmationURL', '.Data', '.RedirectTo', '.Token ', '.Email'])(
    'never uses the template value %s',
    (value) => {
      expect(read(name)).not.toContain(`{{ ${value}`);
    },
  );

  it('carries only the values the link needs', () => {
    const used = [...read(name).matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((match) => match[1]);

    expect(new Set(used)).toEqual(new Set(['.SiteURL', '.TokenHash']));
  });

  it('is simple inline-styled HTML: no scripts, no external files, no tracking', () => {
    const html = read(name);

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/@import|url\(/i);
    expect(html).not.toMatch(/\b(?:src|action)=/i);
    // The only addresses are the template's own link.
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it('is Spanish and plain: the academy, a greeting, the button, the lifetime and the ignore line', () => {
    const html = read(name);

    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Expresión Latina');
    expect(html).toContain('Hola,');
    expect(html).toContain(`>${button}</a>`);
    expect(html).toContain('Este enlace dura 1 hora y solo se puede usar una vez.');
    expect(html).toContain('Si no pediste esto, ignora este mensaje.');
  });
});

describe('the lifetime the templates promise', () => {
  it('is the default of the Auth service: the config does not change otp_expiry', () => {
    expect(CONFIG).not.toMatch(/^\s*otp_expiry\s*=/m);
  });
});
