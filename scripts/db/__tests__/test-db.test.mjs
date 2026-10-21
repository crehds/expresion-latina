import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  RESET_WARNING,
  START_NOTICE,
  SUPABASE_CLI,
  exitCodeFor,
  runTestDb,
  spawnFailureMessage,
} from '../test-db-lib.mjs';

describe('spawnFailureMessage', () => {
  it('reports nothing when the child process actually ran', () => {
    assert.equal(
      spawnFailureMessage({ error: null, status: 1 }, 'supabase status'),
      null,
    );
  });

  it('names the command and the real cause when npx could not be spawned', () => {
    const result = { error: new Error('ENOENT'), status: null };
    assert.equal(
      spawnFailureMessage(result, 'supabase db reset'),
      '[test:db] could not run "supabase db reset": ENOENT',
    );
  });
});

describe('exitCodeFor', () => {
  it('exits non-zero when the child process could not be spawned at all', () => {
    assert.equal(exitCodeFor({ error: new Error('ENOENT'), status: null }), 1);
  });

  it('falls back to the real exit status when the process did run', () => {
    assert.equal(exitCodeFor({ error: null, status: 3 }), 3);
  });

  it('exits non-zero when the process ran but has no exit status', () => {
    // What spawnSync reports for a child that a signal killed.
    assert.equal(exitCodeFor({ error: null, status: null, signal: 'SIGKILL' }), 1);
  });
});

describe('RESET_WARNING', () => {
  it('says the erasure is local only and never touches a hosted project', () => {
    assert.match(RESET_WARNING, /LOCAL/);
    assert.match(RESET_WARNING, /erases local data/);
    assert.match(
      RESET_WARNING,
      /Hosted\/linked Supabase projects are never touched/,
    );
  });
});

describe('START_NOTICE', () => {
  it('does not claim the database is down: a failing status can mean Docker is', () => {
    assert.match(START_NOTICE, /Docker is not running/);
    assert.doesNotMatch(START_NOTICE, /database is not running/);
  });

  it('warns that the first start can take several minutes', () => {
    assert.match(START_NOTICE, /first run pulls Docker images/);
    assert.match(START_NOTICE, /several minutes/);
  });
});

// Runs the whole flow with a stand-in for the Supabase CLI: it records each
// call as a string such as "db reset" and answers from `results` (keyed the
// same way), or with a clean exit when the call has no entry. Nothing is
// spawned, and what the flow prints is collected instead of shown.
function runFlow(results = {}) {
  const calls = [];
  const logged = [];
  const errors = [];
  const code = runTestDb({
    run: (args) => {
      const call = args.join(' ');
      calls.push(call);
      return results[call] ?? { error: null, status: 0 };
    },
    log: (message) => logged.push(message),
    logError: (message) => errors.push(message),
  });
  return {
    code, calls, logged, errors,
  };
}

describe('runTestDb', () => {
  it('skips the start when status already succeeds', () => {
    const { code, calls, logged } = runFlow();
    assert.deepEqual(calls, ['status', 'db reset', 'test db']);
    assert.deepEqual(logged, [RESET_WARNING]);
    assert.equal(code, 0);
  });

  it('starts the database first when status does not succeed', () => {
    const { code, calls, logged } = runFlow({ status: { error: null, status: 1 } });
    assert.deepEqual(calls, ['status', 'db start', 'db reset', 'test db']);
    assert.deepEqual(logged, [START_NOTICE, RESET_WARNING]);
    assert.equal(code, 0);
  });

  it('stops at a failed start, before the reset and the tests, with its exit code', () => {
    const { code, calls, logged } = runFlow({
      status: { error: null, status: 1 },
      'db start': { error: null, status: 3 },
    });
    assert.deepEqual(calls, ['status', 'db start']);
    // The warning comes only when a reset is about to run.
    assert.deepEqual(logged, [START_NOTICE]);
    assert.equal(code, 3);
  });

  it('stops at a failed reset, before the tests, with its exit code', () => {
    const { code, calls } = runFlow({ 'db reset': { error: null, status: 4 } });
    assert.deepEqual(calls, ['status', 'db reset']);
    assert.equal(code, 4);
  });

  it('ends with the exit code of the pgTAP run', () => {
    assert.equal(runFlow({ 'test db': { error: null, status: 5 } }).code, 5);
    // A run that a signal killed has no exit status, and that is a failure.
    assert.equal(runFlow({ 'test db': { error: null, status: null } }).code, 1);
  });

  describe('when the CLI cannot be spawned at all', () => {
    const cannotSpawn = { error: new Error('ENOENT'), status: null };
    // For each step: the calls up to and including it. A status that cannot
    // be spawned must not fall through to the start, as a status that failed
    // does.
    [
      {
        call: 'status', label: 'supabase status', before: {}, calls: ['status'],
      },
      {
        call: 'db start',
        label: 'supabase db start',
        before: { status: { error: null, status: 1 } },
        calls: ['status', 'db start'],
      },
      {
        call: 'db reset', label: 'supabase db reset', before: {}, calls: ['status', 'db reset'],
      },
      {
        call: 'test db',
        label: 'supabase test db',
        before: {},
        calls: ['status', 'db reset', 'test db'],
      },
    ].forEach(({
      call, label, before, calls,
    }) => {
      it(`reports ${label} on stderr, stops there and exits 1`, () => {
        const outcome = runFlow({ ...before, [call]: cannotSpawn });
        assert.deepEqual(outcome.calls, calls);
        assert.deepEqual(outcome.errors, [spawnFailureMessage(cannotSpawn, label)]);
        assert.equal(outcome.code, 1);
      });
    });
  });
});

// The version found in `text`, each with its line: every X.Y.Z that is not the
// tag of a GitHub Action (the `v` in `setup-cli@v3.0.1`) and not part of an IP
// address (127.0.0.1 has one number too many).
function versionsIn(text) {
  return text.split('\n').flatMap((line, index) => (
    [...line.matchAll(/(?<![\w.])\d+\.\d+\.\d+(?!\w|\.\d)/g)]
      .map((match) => ({ line: index + 1, version: match[0] }))
  ));
}

describe('versionsIn', () => {
  it('finds the version of an npx command, a workflow input and a comment', () => {
    const text = [
      'npx --yes supabase@2.0.1 stop',
      '  version: 2.0.2',
      '# verified against the pinned 2.0.3 template.',
    ].join('\n');
    assert.deepEqual(versionsIn(text), [
      { line: 1, version: '2.0.1' },
      { line: 2, version: '2.0.2' },
      { line: 3, version: '2.0.3' },
    ]);
  });

  it('does not take the tag of a GitHub Action or an IP address for one', () => {
    assert.deepEqual(versionsIn('uses: supabase/setup-cli@v3.0.1\nhttp://127.0.0.1:34321'), []);
  });
});

// SUPABASE_CLI is the pin, but the version is also written out as plain text
// elsewhere (see the note above the constant). Those copies cannot import it,
// so this is what notices when one of them is left behind by a bump.
describe('the Supabase CLI version written out beside SUPABASE_CLI', () => {
  const pinned = SUPABASE_CLI.replace(/^supabase@/, '');
  const root = new URL('../../../', import.meta.url);

  [
    '.github/workflows/db-tests.yml',
    'supabase/README.md',
    'supabase/config.toml',
  ].forEach((file) => {
    it(`${file} names ${pinned}, the version SUPABASE_CLI pins, and no other`, () => {
      const found = versionsIn(readFileSync(new URL(file, root), 'utf8'));
      // Without this a file that stopped naming any version would pass.
      assert.ok(found.length > 0, `${file} names no CLI version any more`);
      const drifted = found.filter(({ version }) => version !== pinned);
      assert.deepEqual(
        drifted,
        [],
        `${file} must name ${pinned} (SUPABASE_CLI), but: `
          + `${drifted.map(({ line, version }) => `line ${line} says ${version}`).join(', ')}`,
      );
    });
  });
});
