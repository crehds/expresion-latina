// Pure helpers behind `npm run test:db` (scripts/db/test-db.mjs), split out
// so they can be unit-tested directly without also exercising the entry
// script's process.exit() calls or its `main()` side effects.
import { spawnSync } from 'node:child_process';

// Pinned so local dev and CI always run the exact same CLI build. An
// unpinned `supabase@latest` would let the two environments silently drift
// apart, and a pgTAP failure that only reproduces on one of them is much
// harder to debug than one that reproduces everywhere. The same version is
// also pinned in .github/workflows/db-tests.yml -- bump both together.
export const SUPABASE_CLI = 'supabase@2.117.0';

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
