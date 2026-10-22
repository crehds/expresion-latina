// Everything behind `npm run test:db` (the entry script is
// scripts/db/test-db.mjs), split out of it so the tests can import it without
// running the flow. Only exitCodeFor and spawnFailureMessage are pure: `run`
// spawns the real Supabase CLI, and `runTestDb` takes it as a parameter so
// that a test can hand it a stub instead.
import { spawnSync } from 'node:child_process';

// Pinned so local dev and CI always run the exact same CLI build. An
// unpinned `supabase@latest` would let the two environments silently drift
// apart, and a pgTAP failure that only reproduces on one of them is much
// harder to debug than one that reproduces everywhere. The version is also
// written out in three other places that cannot import this constant: the
// `version:` of the setup-cli step in .github/workflows/db-tests.yml, the
// `supabase@...` commands in supabase/README.md and a comment in
// supabase/config.toml. Bump all four together: the drift test in
// __tests__/test-db.test.mjs fails when one is left behind.
export const SUPABASE_CLI = 'supabase@2.117.0';

// `db reset` re-creates the LOCAL database from the migrations on disk,
// which erases whatever local data (tables, rows, auth users) a contributor
// was poking at in the Docker stack. It never touches a hosted/linked
// Supabase project -- only `supabase link` and `db push` do that, and this
// script never runs them. Printed, not prompted: a confirmation prompt here
// would hang CI and any other non-interactive/scripted run.
export const RESET_WARNING = '[test:db] resetting the LOCAL Supabase database from the migrations on disk -- '
  + 'this erases local data in the Docker stack. Hosted/linked Supabase projects are never touched.';

// Runs the pinned Supabase CLI through npx, with this process's own terminal,
// and returns spawnSync's result.
export function run(args) {
  return spawnSync('npx', ['--yes', SUPABASE_CLI, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

// spawnSync sets `error` (not `status`) when the child process itself could
// not be spawned at all -- e.g. `npx` missing from PATH on a POSIX shell,
// where `shell` is false and Node itself has to exec the binary. Left
// unchecked, `status` stays `null` in that case, and a caller that only
// tests `status !== 0` reads that as "ran and failed" and takes the wrong
// branch, instead of reporting what actually happened.
//
// This does NOT catch a missing `npx` on Windows: `run()` always passes
// `shell: true` there, so spawnSync hands the command line to cmd.exe
// instead of exec'ing `npx` directly. cmd.exe itself fails to find `npx`
// and exits with status 1 -- a normal child-process failure, not a spawn
// failure -- so `error` stays unset and `status` is `1`. On Windows a
// missing `npx` is indistinguishable here from any other command that
// exits 1; only the POSIX no-shell path can report the real cause this way.
export function spawnFailureMessage(result, label) {
  if (!result.error) return null;
  return `[test:db] could not run "${label}": ${result.error.message}`;
}

export function exitCodeFor(result) {
  if (result.error) return 1;
  return result.status ?? 1;
}

// Printed when `supabase status` does not succeed, before the start. A failing
// status does not prove the database is down: it fails the same way when Docker
// itself is not running, and then the start below fails with Docker's own error.
export const START_NOTICE = '[test:db] `supabase status` did not report a running local stack '
  + '(it is stopped, or Docker is not running) -- trying to start it. The first run pulls '
  + 'Docker images and can take several minutes...';

// The whole `npm run test:db` flow: make sure the local stack is up, reset the
// local database, run the pgTAP suite. It returns the exit code the script
// should end with and never calls process.exit() itself. The CLI runner and
// the two output functions are parameters so that a test can hand it a stub
// and collect what it prints; the entry script passes the real ones.
export function runTestDb({
  run: runCli = run,
  log = console.log,
  logError = console.error,
} = {}) {
  // One CLI call. A call that could not even be spawned is reported on stderr.
  const step = (args) => {
    const result = runCli(args);
    const message = spawnFailureMessage(result, `supabase ${args.join(' ')}`);
    if (message) logError(message);
    return result;
  };

  const statusResult = step(['status']);
  // The CLI could not even be spawned, so a start would fail for the same reason.
  if (statusResult.error) return exitCodeFor(statusResult);
  if (statusResult.status !== 0) {
    log(START_NOTICE);
    const startCode = exitCodeFor(step(['db', 'start']));
    if (startCode !== 0) return startCode;
  }

  // `db start` only runs migrations against a fresh database volume; a
  // database left running from a previous invocation would otherwise keep
  // testing whatever migrations were current the first time it started.
  // `db reset` re-applies every migration in supabase/migrations from
  // scratch, so this always tests the migrations on disk right now.
  log(RESET_WARNING);
  const resetCode = exitCodeFor(step(['db', 'reset']));
  if (resetCode !== 0) return resetCode;

  return exitCodeFor(step(['test', 'db']));
}
