/** @vitest-environment node */
/*
 * Server render is pure: rendering a component's docs demos on the server writes no signal, store
 * or optimistic state (Solid's `SERVER_WRITE`, deprecated and slated to become an error). React
 * never runs layout effects or state setters while rendering on the server either.
 * Each component renders in its own process: Solid reports a write category once per process.
 */
import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const demos = resolve(here, '../../../../docs/solid/src/demos/solid');

function demoFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return demoFiles(full);
    }
    return entry === 'index.tsx' ? [full] : [];
  });
}

const components = readdirSync(demos).filter((entry) => statSync(join(demos, entry)).isDirectory());

describe('server render purity', () => {
  it.each(components)(
    '%s writes no state while rendering on the server',
    async (component) => {
      const { stdout } = await execFileAsync(
        'node',
        [join(here, 'serverWrites.mjs'), ...demoFiles(join(demos, component))],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      const writes = JSON.parse(stdout) as Record<string, { message: string; frames: string[] }[]>;
      const report = Object.entries(writes).map(
        ([file, entries]) =>
          `${file.slice(demos.length + 1)}: ${entries
            .map((entry) => `${entry.message} @ ${entry.frames.join(' < ')}`)
            .join(' | ')}`,
      );
      expect(report).toEqual([]);
    },
    120_000,
  );
});
