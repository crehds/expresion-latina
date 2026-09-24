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
// harder to debug than one that reproduces everywhere.
const SUPABASE_CLI = 'supabase@2.117.0';

function run(args) {
  return spawnSync('npx', ['--yes', SUPABASE_CLI, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const status = run(['status']);
if (status.status !== 0) {
  console.log(
    '[test:db] local Supabase database is not running -- starting it now '
      + '(the first run pulls Docker images and can take several minutes)...',
  );
  const start = run(['db', 'start']);
  if (start.status !== 0) {
    process.exit(start.status ?? 1);
  }
}

// `db start` only runs migrations against a fresh database volume; a
// database left running from a previous invocation would otherwise keep
// testing whatever migrations were current the first time it started.
// `db reset` re-applies every migration in supabase/migrations from
// scratch, so this always tests the migrations on disk right now.
const reset = run(['db', 'reset']);
if (reset.status !== 0) {
  process.exit(reset.status ?? 1);
}

const test = run(['test', 'db']);
process.exit(test.status ?? 1);
