import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RESET_WARNING,
  exitCodeFor,
  spawnFailureMessage,
} from '../test-db.mjs';

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
