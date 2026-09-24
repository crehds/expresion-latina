// Runs the pgTAP suite (supabase/tests/database) against the local
// Supabase stack, starting the database first when it is not already
// running. A single Node script keeps this portable across the shells
// contributors use on Windows/macOS/Linux -- npm's script-shell differs
// per platform, and chained `&&`/`||` shell syntax in package.json does
// not behave the same way everywhere.
//
// This file is a plain entry script, always invoked directly as
// `node scripts/db/test-db.mjs` (see the `test:db` npm script) and never
// imported. The pure helpers it uses live in ./test-db-lib.mjs, which the
// tests under __tests__/ import instead of this file, so testing them
// never triggers main()'s process.exit() calls.
import {
  RESET_WARNING,
  exitCodeFor,
  run,
  spawnFailureMessage,
} from './test-db-lib.mjs';

function runOrExit(args, label) {
  const result = run(args);
  const message = spawnFailureMessage(result, label);
  if (message) {
    console.error(message);
    process.exit(exitCodeFor(result));
  }
  return result;
}

function main() {
  const status = runOrExit(['status'], 'supabase status');
  if (status.status !== 0) {
    console.log(
      '[test:db] local Supabase database is not running -- starting it now '
        + '(the first run pulls Docker images and can take several minutes)...',
    );
    const start = runOrExit(['db', 'start'], 'supabase db start');
    if (start.status !== 0) {
      process.exit(exitCodeFor(start));
    }
  }

  // `db start` only runs migrations against a fresh database volume; a
  // database left running from a previous invocation would otherwise keep
  // testing whatever migrations were current the first time it started.
  // `db reset` re-applies every migration in supabase/migrations from
  // scratch, so this always tests the migrations on disk right now.
  console.log(RESET_WARNING);
  const reset = runOrExit(['db', 'reset'], 'supabase db reset');
  if (reset.status !== 0) {
    process.exit(exitCodeFor(reset));
  }

  const test = runOrExit(['test', 'db'], 'supabase test db');
  process.exit(exitCodeFor(test));
}

main();
