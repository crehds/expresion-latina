// Proves the lint boundary (Design: D10) by linting snippets through ESLint's
// own API with the repository's real configuration, so the test fails if the
// rule or its override is ever loosened or removed.
import path from 'node:path';
import { ESLint } from 'eslint';

// Linting through ESLint's API is slow under full-suite load and can pass the
// 5000 ms default, so this file gets more room. Every assertion is unchanged.
vi.setConfig({ testTimeout: 20000 });

const eslint = new ESLint({ cwd: path.resolve(__dirname, '../../..') });

async function ruleIdsFor(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  // Only errors count: airbnb ships some of these rules as warnings, and a
  // warning does not fail the lint run.
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId);
}

const SUPABASE_IMPORT = "import { createClient } from '@supabase/supabase-js';\nexport default createClient;\n";

describe('the supabase-js import boundary', () => {
  it.each([
    'src/features/accounts/ui/SignInForm.jsx',
    'src/features/accounts/composition/SessionProvider.jsx',
    'src/shared/other.js',
    'src/pages/Login/Login.jsx',
  ])('rejects a static import outside the backend and the adapters: %s', async (filePath) => {
    expect(await ruleIdsFor(SUPABASE_IMPORT, filePath)).toContain('no-restricted-imports');
  });

  it.each([
    'src/shared/backend/other.js',
    'src/features/accounts/adapters/authAdapter.js',
    'src/features/attendance/adapters/attendanceAdapter.js',
  ])('allows a static import inside the backend and the adapters: %s', async (filePath) => {
    expect(await ruleIdsFor(SUPABASE_IMPORT, filePath)).not.toContain('no-restricted-imports');
  });

  it('explains where the import is allowed', async () => {
    const [result] = await eslint.lintText(SUPABASE_IMPORT, {
      filePath: 'src/features/accounts/ui/SignInForm.jsx',
    });
    const message = result.messages.find((m) => m.ruleId === 'no-restricted-imports');

    expect(message.message).toMatch(/src\/shared\/backend/);
    expect(message.message).toMatch(/adapters/);
  });
});

describe('react/no-danger', () => {
  it('rejects dangerouslySetInnerHTML', async () => {
    const code = "export default function Bad() {\n  return <div dangerouslySetInnerHTML={{ __html: 'x' }} />;\n}\n";

    expect(await ruleIdsFor(code, 'src/features/accounts/ui/Bad.jsx')).toContain('react/no-danger');
  });
});
