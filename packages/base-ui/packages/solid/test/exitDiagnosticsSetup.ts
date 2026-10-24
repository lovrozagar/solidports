/*
 * Keeps the jsdom exit records (`test/exitDiagnostics.ts`) from growing with every run: a full run
 * leaves about 520 files in its run dir. Runs once per vitest run, in the main process, before
 * any worker writes: the newest runs stay, the older ones go.
 */
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Run dirs kept, this run's included: enough to compare a failure with the passes before it. */
const KEEP = 5;
const EXITS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../.tmp/grunt/jsdom-exits',
);

/**
 * Removes all but the newest `keep` run dirs under `dir`, by modification time. Only a dir named
 * by a pid (digits) is a run dir; anything else is left alone. Each path is the records dir joined
 * with one entry `readdir` returned, never one built from a variable path.
 */
export function pruneExitRuns(dir: string, keep: number) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const runs = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => {
      const at = path.join(dir, entry.name);
      return { at, mtime: statSync(at).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const run of runs.slice(keep)) {
    rmSync(run.at, { recursive: true, force: true });
  }
}

export default function setup() {
  // This run's dir comes later, from its first worker: keep one fewer of the older ones.
  pruneExitRuns(EXITS_DIR, KEEP - 1);
}
