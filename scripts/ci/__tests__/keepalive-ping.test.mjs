import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { spawn } from 'node:child_process';

const REPO_ROOT = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  '..',
);
const SCRIPT_RELATIVE_PATH = 'scripts/ci/keepalive-ping.sh';
const STUB_KEY = 'stub-publishable-key';

// A bare "bash" on Windows can resolve to WSL's bash.exe under System32
// (Docker Desktop installs WSL) instead of Git for Windows. Git for
// Windows' own usr/bin/bash.exe, unlike its bin/bash.exe wrapper, does
// not reliably put /mingw64/bin -- where curl lives -- on PATH when
// launched non-interactively, so resolve the wrapper explicitly instead
// of trusting PATH order.
function resolveBash() {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  const programFilesRoots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
  ].filter(Boolean);
  const candidates = programFilesRoots.map((root) => path.join(root, 'Git', 'bin', 'bash.exe'));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `Could not find Git for Windows' bash.exe (checked: ${candidates.join(', ')}). `
        + 'Install Git for Windows, or adjust resolveBash() if it lives elsewhere.',
    );
  }
  return found;
}

// Runs the real script with the real bash and real curl -- never
// spawnSync/execFileSync, which would block this process's event loop
// and starve the in-process stub server below of the chance to answer.
function runScript(env, { timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBash(), [SCRIPT_RELATIVE_PATH], {
      cwd: REPO_ROOT,
      env,
      timeout,
      killSignal: 'SIGKILL',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({
      code, stdout, stderr, signal,
    }));
  });
}

// Starts from process.env so bash and curl are still found on PATH, then
// always clears every var this script reads so a case only ever sees the
// values it explicitly sets.
function buildEnv(overrides) {
  const env = { ...process.env };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_PUBLISHABLE_KEY;
  delete env.KEEPALIVE_ENABLED;
  delete env.KEEPALIVE_STRICT;
  return { ...env, ...overrides };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertKeyNeverLeaked(result, key) {
  const pattern = new RegExp(escapeRegExp(key));
  assert.doesNotMatch(result.stdout, pattern);
  assert.doesNotMatch(result.stderr, pattern);
}

// A local node:http stub standing in for the Supabase project: records
// every request and answers from a scripted sequence of status codes,
// repeating the last one once the sequence is exhausted.
function startStub(statusSequence) {
  return new Promise((resolve, reject) => {
    const requests = [];
    const server = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        requests.push({
          method: req.method,
          path: req.url,
          apikey: req.headers.apikey ?? null,
        });
        const index = Math.min(requests.length - 1, statusSequence.length - 1);
        res.writeHead(statusSequence[index], { 'content-type': 'text/plain' });
        res.end('stub response body');
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((r) => {
          server.close(() => r());
        }),
      });
    });
  });
}

describe('scripts/ci/keepalive-ping.sh', () => {
  describe('KEEPALIVE_STRICT validation (no secrets reachable)', () => {
    it('is dormant when neither secret is set and KEEPALIVE_STRICT is unset', async () => {
      const result = await runScript(buildEnv({}));
      assert.equal(result.code, 0);
      assert.match(result.stdout, /::notice::/);
    });

    it('is dormant when neither secret is set and KEEPALIVE_STRICT=false', async () => {
      const result = await runScript(buildEnv({ KEEPALIVE_STRICT: 'false' }));
      assert.equal(result.code, 0);
      assert.match(result.stdout, /::notice::/);
    });

    it('fails when neither secret is set and KEEPALIVE_STRICT=true', async () => {
      const result = await runScript(buildEnv({ KEEPALIVE_STRICT: 'true' }));
      assert.equal(result.code, 1);
      assert.match(result.stdout + result.stderr, /::error::/);
    });

    it('is case-insensitive: KEEPALIVE_STRICT=TRUE fails the same way', async () => {
      const result = await runScript(buildEnv({ KEEPALIVE_STRICT: 'TRUE' }));
      assert.equal(result.code, 1);
      assert.match(result.stdout + result.stderr, /::error::/);
    });

    it(
      'rejects an invalid KEEPALIVE_STRICT="1", naming the accepted values, before ever calling curl',
      async () => {
        const stub = await startStub([204]);
        try {
          const result = await runScript(buildEnv({
            KEEPALIVE_STRICT: '1',
            SUPABASE_URL: stub.url,
            SUPABASE_PUBLISHABLE_KEY: STUB_KEY,
          }));
          const output = result.stdout + result.stderr;
          assert.equal(result.code, 1);
          assert.match(output, /::error::/);
          assert.match(output, /true/);
          assert.match(output, /false/);
          assert.match(output, /1/);
          assert.equal(stub.requests.length, 0);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
    );

    it(
      'rejects an invalid KEEPALIVE_STRICT="yes" the same way, before ever calling curl',
      async () => {
        const stub = await startStub([204]);
        try {
          const result = await runScript(buildEnv({
            KEEPALIVE_STRICT: 'yes',
            SUPABASE_URL: stub.url,
            SUPABASE_PUBLISHABLE_KEY: STUB_KEY,
          }));
          const output = result.stdout + result.stderr;
          assert.equal(result.code, 1);
          assert.match(output, /::error::/);
          assert.match(output, /true/);
          assert.match(output, /false/);
          assert.equal(stub.requests.length, 0);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
    );

    it('fails when only SUPABASE_URL is set, KEEPALIVE_STRICT unset, with zero requests', async () => {
      const stub = await startStub([204]);
      try {
        const result = await runScript(buildEnv({ SUPABASE_URL: stub.url }));
        assert.equal(result.code, 1);
        assert.match(result.stdout + result.stderr, /::error::/);
        assert.equal(stub.requests.length, 0);
      } finally {
        await stub.close();
      }
    });

    it('fails when only SUPABASE_URL is set, KEEPALIVE_STRICT=true, with zero requests', async () => {
      const stub = await startStub([204]);
      try {
        const result = await runScript(buildEnv({ SUPABASE_URL: stub.url, KEEPALIVE_STRICT: 'true' }));
        assert.equal(result.code, 1);
        assert.match(result.stdout + result.stderr, /::error::/);
        assert.equal(stub.requests.length, 0);
      } finally {
        await stub.close();
      }
    });

    it('fails when only SUPABASE_PUBLISHABLE_KEY is set, KEEPALIVE_STRICT unset', async () => {
      const result = await runScript(buildEnv({ SUPABASE_PUBLISHABLE_KEY: STUB_KEY }));
      assert.equal(result.code, 1);
      const output = result.stdout + result.stderr;
      assert.match(output, /::error::/);
      assertKeyNeverLeaked(result, STUB_KEY);
    });

    it('fails when only SUPABASE_PUBLISHABLE_KEY is set, KEEPALIVE_STRICT=true', async () => {
      const result = await runScript(buildEnv({ SUPABASE_PUBLISHABLE_KEY: STUB_KEY, KEEPALIVE_STRICT: 'true' }));
      assert.equal(result.code, 1);
      const output = result.stdout + result.stderr;
      assert.match(output, /::error::/);
      assertKeyNeverLeaked(result, STUB_KEY);
    });
  });

  describe('HTTP outcomes (both secrets set, pointing at a local stub)', () => {
    it(
      'succeeds on a single 204 with exactly one POST carrying the apikey header',
      async () => {
        const stub = await startStub([204]);
        try {
          const result = await runScript(buildEnv({
            SUPABASE_URL: stub.url,
            SUPABASE_PUBLISHABLE_KEY: STUB_KEY,
          }));
          assert.equal(result.code, 0);
          assert.equal(stub.requests.length, 1);
          assert.equal(stub.requests[0].method, 'POST');
          assert.equal(stub.requests[0].path, '/rest/v1/rpc/keepalive');
          assert.equal(stub.requests[0].apikey, STUB_KEY);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
      { timeout: 15000 },
    );

    it(
      'fails after exactly one request on a 401 (wrong key)',
      async () => {
        const stub = await startStub([401]);
        try {
          const result = await runScript(
            buildEnv({ SUPABASE_URL: stub.url, SUPABASE_PUBLISHABLE_KEY: STUB_KEY }),
            { timeout: 10000 },
          );
          assert.equal(result.code, 1);
          assert.match(result.stdout + result.stderr, /::error::/);
          assert.equal(stub.requests.length, 1);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
      { timeout: 15000 },
    );

    it(
      'fails after exactly one request on a 404 (wrong URL)',
      async () => {
        const stub = await startStub([404]);
        try {
          const result = await runScript(
            buildEnv({ SUPABASE_URL: stub.url, SUPABASE_PUBLISHABLE_KEY: STUB_KEY }),
            { timeout: 10000 },
          );
          assert.equal(result.code, 1);
          assert.match(result.stdout + result.stderr, /::error::/);
          assert.equal(stub.requests.length, 1);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
      { timeout: 15000 },
    );

    it(
      'recovers on a 503 then 204 after exactly two requests',
      async () => {
        const stub = await startStub([503, 204]);
        try {
          const result = await runScript(
            buildEnv({ SUPABASE_URL: stub.url, SUPABASE_PUBLISHABLE_KEY: STUB_KEY }),
            { timeout: 18000 },
          );
          assert.equal(result.code, 0);
          assert.equal(stub.requests.length, 2);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
      { timeout: 20000 },
    );

    it(
      'fails after exactly four requests when every attempt gets a 503',
      async () => {
        const stub = await startStub([503]);
        try {
          const result = await runScript(
            buildEnv({ SUPABASE_URL: stub.url, SUPABASE_PUBLISHABLE_KEY: STUB_KEY }),
            { timeout: 25000 },
          );
          assert.equal(result.code, 1);
          assert.match(result.stdout + result.stderr, /::error::/);
          assert.equal(stub.requests.length, 4);
          assertKeyNeverLeaked(result, STUB_KEY);
        } finally {
          await stub.close();
        }
      },
      { timeout: 30000 },
    );

    it(
      'fails on a transport-level error such as a refused connection',
      async () => {
        const stub = await startStub([204]);
        const { url } = stub;
        await stub.close();
        const result = await runScript(
          buildEnv({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: STUB_KEY }),
          { timeout: 25000 },
        );
        assert.notEqual(result.code, 0);
        assert.match(result.stdout + result.stderr, /::error::/);
        assertKeyNeverLeaked(result, STUB_KEY);
      },
      { timeout: 30000 },
    );
  });
});
