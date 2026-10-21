// Runs the pgTAP suite (supabase/tests/database) against the local
// Supabase stack, starting the database first when it is not already
// running. A single Node script keeps this portable across the shells
// contributors use on Windows/macOS/Linux -- npm's script-shell differs
// per platform, and chained `&&`/`||` shell syntax in package.json does
// not behave the same way everywhere.
//
// This file is a plain entry script, always invoked directly as
// `node scripts/db/test-db.mjs` (see the `test:db` npm script) and never
// imported. The flow itself is `runTestDb` in ./test-db-lib.mjs, which the
// tests under __tests__/ drive with a stub in place of the Supabase CLI.
// All that is left here is to hand it the real CLI and exit with its code,
// the one part of the flow those tests do not run: `npm run test:db` does.
import { runTestDb } from './test-db-lib.mjs';

process.exit(runTestDb());
