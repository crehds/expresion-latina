// Runs the pgTAP suite (supabase/tests/database) against the local
// Supabase stack, starting the database first when it is not already
// running. A single Node script keeps this portable across the shells
// contributors use on Windows/macOS/Linux -- npm's script-shell differs
// per platform, and chained `&&`/`||` shell syntax in package.json does
// not behave the same way everywhere.
import { spawnSync } from 'node:child_process';

// Pinned so local dev and CI always run the exact same CLI build. An
// unpinned `supabase@latest` would let the two environments silently drift
// apart, and a pgTAP failure that only reproduces on one of them is much
// harder to debug than one that reproduces everywhere. The same version is
// also pinned in .github/workflows/db-tests.yml -- bump both together.
const SUPABASE_CLI = 'supabase@2.117.0';

// `db reset` re-creates the LOCAL database from the migrations on disk,
// which erases whatever local data (tables, rows, auth users) a contributor
// was poking at in the Docker stack. It never touches a hosted/linked
// Supabase project -- only `supabase link` and `db push` do that, and this
// script never runs them. Printed, not prompted: a confirmation prompt here
// would hang CI and any other non-interactive/scripted run.
export const RESET_WARNING = '[test:db] resetting the LOCAL Supabase database from the migrations on disk -- '
  + 'this erases local data in the Docker stack. Hosted/linked Supabase projects are never touched.';

export function run(args) {
  return spawnSync('npx', ['--yes', SUPABASE_CLI, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

// spawnSync sets `error` (not `status`) when the child process itself could
// not be spawned at all -- e.g. `npx` missing from PATH. Left unchecked,
// `status` stays `null`, and a caller that only tests `status !== 0` reads
// that as "ran and failed" and takes the wrong branch, instead of reporting
// what actually happened.
export function spawnFailureMessage(result, label) {
  if (!result.error) return null;
  return `[test:db] could not run "${label}": ${result.error.message}`;
}

export function exitCodeFor(result) {
  if (result.error) return 1;
  return result.status ?? 1;
}

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
      process.exit(start.status ?? 1);
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
    process.exit(reset.status ?? 1);
  }

  const test = runOrExit(['test', 'db'], 'supabase test db');
  process.exit(test.status ?? 1);
}

if (
  process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())
) {
  main();
}
