/*
 * Exit records for the jsdom workers. A full jsdom run once ended with exit 1 and no summary
 * line under load, and passed when rerun: which worker died, how and where was never seen. Each
 * worker (a forked process) appends a line when it starts a test file, one when the file
 * finishes, and one when it exits, with its exit code and memory, to
 * `.tmp/grunt/jsdom-exits/<vitest pid>/<worker pid>.jsonl`. A worker killed by a signal runs no
 * exit handler, and the pool ends idle workers that way too, so a file started and never finished
 * is where a worker died.
 * `scripts/jsdom-exits.mjs` reads a run. jsdom only: browser mode has no file system.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect } from 'vitest';

// The test env types `process` as `vitest-env.d.ts`'s browser-safe subset; this file runs in Node.
const node = process as unknown as NodeJS.Process;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const runDir = path.join(root, '.tmp/grunt/jsdom-exits', String(node.ppid));
const logFile = path.join(runDir, `${node.pid}.jsonl`);

function record(entry: Record<string, unknown>) {
  try {
    mkdirSync(runDir, { recursive: true });
    appendFileSync(logFile, `${JSON.stringify({ pid: node.pid, t: Date.now(), ...entry })}\n`);
  } catch {
    // A diagnostic: a write that fails must not fail a test.
  }
}

// The setup file runs again for every test file in the same worker: one exit handler per worker.
const REGISTERED = Symbol.for('base-ui.exitDiagnostics');
const host = node as unknown as Record<symbol, boolean>;
if (!host[REGISTERED]) {
  host[REGISTERED] = true;
  node.on('exit', (code) => {
    const { rss, heapUsed } = node.memoryUsage();
    record({ event: 'exit', code, rss, heapUsed });
  });
}

const testFile = () => path.relative(root, expect.getState().testPath ?? '');
beforeAll(() => record({ event: 'file', file: testFile() }));
// The pool ends finished workers with a signal: a file with no `done` is where a worker died.
afterAll(() => record({ event: 'done', file: testFile() }));
