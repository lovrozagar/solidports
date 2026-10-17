// Fails a filtered vitest run whose file filters miss: Vitest keeps a test file when its path
// contains a filter, and a filter that matches nothing is silently dropped, so a run of
// `test:solid:jsdom a b` that only matched `a` still passes. `bun run` starts the script in
// `packages/base-ui`, so a path filter is resolved from there (`packages/solid/src/…`).
import fs from 'node:fs';
import path from 'node:path';
import { parseCLI } from 'vitest/node';

/**
 * The filters a run's test files do not satisfy: a filter no file matched, or a path filter that
 * matched fewer files than the test files under that path.
 * @param {readonly string[]} filters The run's file filters.
 * @param {readonly string[]} matched The run's test files, absolute.
 * @param {string} cwd The directory path filters resolve from.
 * @param {(dir: string) => readonly string[]} filesUnder The test files under an existing path.
 * @returns {string[]}
 */
export function filterMisses(filters, matched, cwd, filesUnder) {
  const misses = [];
  for (const filter of filters) {
    const lower = filter.toLowerCase();
    const resolved = path.resolve(cwd, filter);
    const hits = new Set(
      matched.filter((file) => file.toLowerCase().includes(lower) || file.startsWith(resolved)),
    );
    if (hits.size === 0) {
      misses.push(`"${filter}" matched 0 files`);
      continue;
    }
    if (fs.existsSync(resolved)) {
      const total = new Set(filesUnder(resolved)).size;
      if (hits.size < total) {
        misses.push(`"${filter}" matched ${hits.size} of ${total} files`);
      }
    }
  }
  return misses;
}

/**
 * The file filters on a Vitest command line (`argv` after the script), read with Vitest's own
 * parser, so option values (`--project @solidports/base-ui`) are not taken for filters.
 * @param {readonly string[]} argv
 * @returns {string[]}
 */
export function cliFilters(argv) {
  return parseCLI(['vitest', ...argv], { allowUnknownOptions: true }).filter.map(String);
}

/**
 * The filters to check: Vitest's record of them (`filenamePattern`, internal in Vitest 4.1). When
 * the command line has filters but that record is missing, Vitest's internals changed and the
 * guard would pass every run: fail instead.
 * @param {unknown} recorded
 * @param {readonly string[]} cli
 * @returns {readonly string[]}
 */
export function runFilters(recorded, cli) {
  if (cli.length === 0) {
    return [];
  }
  if (!Array.isArray(recorded)) {
    throw new Error(
      'Base UI tests: filter guard: vitest internals changed, update vitest-filter-guard.mjs',
    );
  }
  return recorded;
}

/** The reporter: checks the run's filters once its test files are known. */
export default class VitestFilterGuard {
  onInit(vitest) {
    this.vitest = vitest;
  }

  async onTestRunStart(specifications) {
    const filters = runFilters(this.vitest.filenamePattern, cliFilters(process.argv.slice(2)));
    if (filters.length === 0) {
      return;
    }
    const matched = specifications.map((specification) => specification.moduleId);
    const under = new Map();
    for (const filter of filters) {
      const resolved = path.resolve(process.cwd(), filter);
      if (fs.existsSync(resolved)) {
        // An absolute filter matches every test file under it, in the run's projects.
        const all = await this.vitest.globTestSpecifications([resolved]);
        under.set(
          resolved,
          all.map((specification) => specification.moduleId),
        );
      }
    }
    const misses = filterMisses(filters, matched, process.cwd(), (dir) => under.get(dir) ?? []);
    if (misses.length > 0) {
      const message = `Base UI tests: ${misses.map((miss) => `filter ${miss}`).join('; ')}. Filters match test paths from packages/base-ui (for example packages/solid/src/collapsible).`;
      this.vitest.logger.error(message);
      process.exitCode = 1;
      throw new Error(message);
    }
  }
}
