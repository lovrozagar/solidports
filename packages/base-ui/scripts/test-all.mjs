/* eslint-disable no-console */
// Runs every suite the "Base UI tests" workflow (.github/workflows/base-ui-tests.yml) runs, with the
// same commands, then prints each suite's result and exits 1 when any failed. A suite that cannot
// run on this machine is reported as "not run", never left out. Each run writes its logs to
// .tmp/base-ui-test-all/<stamp>/<suite>.log at the monorepo root (`latest` points at the newest),
// and only one run per tree may be active: a second one is refused, naming the PID holding it.
//
// Suites run concurrently: light ones (lint, typecheck, package, generated files) up to
// GATES_LIGHT at a time (default 4), heavy ones (test runners, browsers, docs builds) up to
// GATES_HEAVY (default 2), and `after` keeps a chain ordered. Suites marked `exclusive` (they
// launch browsers or bind fixed ports) run one at a time here, and each command takes an flock on a
// machine-wide lock shared with other repos' gates, so two sessions never fight over a port or a
// browser; the lock waits rather than fails, and says so in the log.
//
// The benchmark suite is a one-run correctness check (DOM summaries, known differences); measured
// runs are `bench:component` and `--full-bench`.
//
// Usage (from the monorepo root):
//   bun run test:base-ui:all [--only <suite>,<suite>] [--list] [--full-bench]
//   bun run test:base-ui:all --changed [ref]   every light suite whole, and jsdom and chromium
//                                              on vitest's module-graph diff against HEAD
//                                              (uncommitted changes) or the ref, and Firefox
//                                              and WebKit parity on the range's browser test
//                                              files (WebKit in Playwright's Docker image),
//                                              and docs-validate on the pages the range can
//                                              change (`changedDocsPages`)
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const baseUi = 'packages/base-ui';
const solid = 'packages/base-ui/packages/solid';

/** Whether `command` is on PATH. */
function hasCommand(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

const logRoot = path.join(root, '.tmp/base-ui-test-all');

/**
 * The machine lock every repo's heavy gates take around their browser runs
 * (`~/.cache/gates/heavy.lock`; flare's take it too), so they exclude each other; `GATES_LOCK`
 * overrides it.
 */
export const EXCLUSIVE_LOCK =
  process.env.GATES_LOCK ?? path.join(os.homedir(), '.cache/gates/heavy.lock');

/**
 * Seconds an exclusive command may hold the lock before `timeout` kills it (SIGTERM, then SIGKILL
 * 30 s later), so a hung browser run cannot block other gates; a suite may set `timeoutSeconds`.
 */
export const LOCK_TIMEOUT_SECONDS = Number(process.env.GATES_TIMEOUT ?? 1200);

/**
 * Seconds each step of a full WebKit parity run may take in Playwright's Docker image: 1.5 times
 * the slower of two measured full runs' slowest step (`context/testing/suites.md`).
 */
const WEBKIT_STEP_TIMEOUT_SECONDS = 1425;

// One entry per workflow step, grouped by job. `generated` lists the paths the step may rewrite;
// it fails when it changes any of them (the workflow's `git diff --exit-code`, scoped so suites
// running beside it cannot be blamed on it, and without discarding local changes first).
// `heavy` suites count against GATES_HEAVY; `after` names the suite this one waits for. Under
// `--changed` every light suite runs whole, whatever the range (about 50 s together): selecting
// them by the files a range changes let four CI-only failures through, one suite at a time (eslint
// 4ada29ab, docs-generate fadd8eb5, vale 2c766d1e, error-codes 9a9f246b). The vitest suites run on
// the module-graph diff. The parity suites run scoped, on the Solid test files the range changed
// or changed a source file beside (CI's parity caught new tests only after the push: a WebKit
// mousemove test, and a Firefox pointer-lock test in run 39799938293); their `fullOnly` names the
// whole run that only a full run or CI does. docs-validate runs on the docs pages the range can
// change (`changedDocsPages`; CI caught a stale toast types page, 66627259). docs-build and
// docs-hydration run whole when the range changes a library source file (`changedLibrarySource`;
// CI caught a server-native Tabs.Panel's docs hydration, 40162124626). Every other heavy suite
// names in `fullOnly` why only a full run or CI runs it.
export const suites = [
  { job: 'Linting', name: 'format', cwd: '.', run: ['bun run fmt:check'] },
  { job: 'Linting', name: 'oxlint', cwd: '.', run: ['bun run lint'] },
  {
    job: 'Linting',
    name: 'eslint',
    cwd: baseUi,
    run: [
      'bunx eslint packages/solid/src packages/solid/test docs/solid/src test/perf-solid --report-unused-disable-directives --max-warnings 0',
    ],
  },
  { job: 'Linting', name: 'eslint-rule-tests', cwd: baseUi, run: ['bun run test:lint-rules'] },
  {
    job: 'Linting',
    name: 'stylelint',
    cwd: baseUi,
    run: [
      "bunx stylelint --reportInvalidScopeDisables --reportNeedlessDisables 'docs/solid/**/*.css' --ignore-path .lintignore",
    ],
  },
  {
    job: 'Linting',
    name: 'vale',
    cwd: baseUi,
    run: ['bun run valelint'],
    // `.vale.ini` reads its MUI styles from the repository's install (`../../` from Base UI): a
    // worktree without an install of its own has none there.
    unavailable: fs.existsSync(path.join(root, 'node_modules/@mui/internal-code-infra/vale'))
      ? null
      : "needs this tree's own install (.vale.ini reads its styles from it)",
  },
  {
    job: 'Generated files',
    name: 'error-codes',
    cwd: baseUi,
    generated: ['packages/base-ui/docs/react/src/error-codes.json'],
    run: ['bun run extract-error-codes'],
    // code-infra's extractor lists the workspace with `pnpm ls`.
    unavailable: hasCommand('pnpm') ? null : 'needs pnpm (code-infra lists the workspace with it)',
  },
  {
    // docs/solid is generated from docs/react (`scripts/docs`): a generator change or a docs sync
    // that is not regenerated leaves it stale, which nothing else would catch.
    job: 'Generated files',
    name: 'docs-generate',
    cwd: baseUi,
    generated: ['packages/base-ui/docs/solid'],
    run: ['bun run docs:generate'],
  },
  {
    job: 'Generated files',
    name: 'inline-scripts',
    cwd: baseUi,
    generated: ['packages/base-ui/packages/react/src', 'packages/base-ui/packages/solid/src'],
    run: ['bun run inline-scripts'],
  },
  {
    job: 'Generated files',
    name: 'test-parity',
    cwd: baseUi,
    run: ['node scripts/test-parity.mjs'],
  },
  {
    job: 'Typechecking',
    name: 'typecheck',
    cwd: '.',
    run: ['bun run typecheck'],
  },
  {
    job: 'Typechecking',
    name: 'typecheck-solid',
    cwd: solid,
    run: ['bun run typescript', 'bunx tsc -p tsconfig.test.json --noEmit'],
  },
  {
    job: 'Typechecking',
    name: 'typecheck-docs',
    cwd: 'packages/base-ui/docs/solid',
    run: ['bun run typescript --noEmit'],
  },
  {
    job: 'Typechecking (typescript@next)',
    name: 'typecheck-next',
    cwd: solid,
    run: ['bunx --package typescript@next tsc -b tsconfig.json'],
  },
  {
    job: 'Package',
    name: 'package',
    cwd: solid,
    run: ['bun run types', 'bun run test:built-types', 'bun run test:package'],
  },
  {
    job: 'Package',
    name: 'public-types',
    cwd: 'packages/base-ui/test/public-types-solid',
    after: 'package',
    run: ['bun run release:test'],
  },
  {
    job: 'Package',
    name: 'node-resolution',
    cwd: 'packages/base-ui/test/node-resolution-solid',
    after: 'public-types',
    run: ['bun run test'],
  },
  {
    job: 'JSDOM tests',
    name: 'jsdom',
    cwd: baseUi,
    heavy: true,
    vitest: true,
    // As the workflow: the package tests check each export's declaration file in `types/`.
    run: ['bun run --cwd packages/solid types', 'bun run test:solid:jsdom --run --maxWorkers=2'],
  },
  {
    job: 'Browser tests',
    name: 'chromium',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    vitest: true,
    run: ['bun run test:solid:chromium --run --maxWorkers=2'],
  },
  // The browser parity workflow: upstream's suite and the Solid suite in Firefox and WebKit, failing
  // on Solid-only failures (upstream's CI runs neither browser). WebKit runs, its confirm reruns
  // included, in Playwright's Docker image (`scripts/webkit-docker.sh`): local WebKit lacks the
  // host's libraries. Each of its steps gets WEBKIT_STEP_TIMEOUT_SECONDS.
  ...['firefox', 'webkit'].map((browser) => {
    const docker = browser === 'webkit';
    const report = (suite) => `"$TEST_ALL_RUN_DIR/${suite}-${browser}.json"`;
    const suiteRun = (suite, script) =>
      docker
        ? `bash scripts/webkit-docker.sh ${script} ${report(suite)} || true`
        : `bun run ${script} --run --maxWorkers=2 --reporter=json --outputFile=${report(suite)} || true`;
    return {
      job: 'Browser parity',
      name: `parity-${browser}`,
      browser,
      cwd: baseUi,
      heavy: true,
      exclusive: true,
      ...(docker ? { timeoutSeconds: WEBKIT_STEP_TIMEOUT_SECONDS } : {}),
      fullOnly: 'runs both suites whole in the browser',
      run: [
        suiteRun('react', `test:${browser}`),
        suiteRun('solid', `test:solid:${browser}`),
        `${docker ? 'PARITY_RUNNER=scripts/webkit-docker.sh ' : ''}node scripts/browser-parity.mjs ${report('react')} ${report('solid')} --confirm ${browser}`,
      ],
    };
  }),
  {
    job: 'E2E tests',
    name: 'e2e',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    fullOnly: 'builds and serves the e2e app',
    run: ['bun run test:e2e:solid'],
  },
  {
    job: 'Regression tests',
    name: 'regressions',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    fullOnly: 'builds the regression app and screenshots every fixture',
    run: ['bun run test:regressions:solid:build', 'bun run test:regressions:solid'],
  },
  {
    job: 'Screen Reader',
    name: 'screen-reader',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    fullOnly: 'drives NVDA on Windows',
    // NVDA, which the suite drives, runs only on Windows; CI runs it on windows-2025.
    unavailable: process.platform === 'win32' ? null : 'needs Windows and NVDA; CI runs it',
    run: [
      'bunx guidepup install',
      'bunx playwright test --config test/screen-reader-solid/playwright.config.ts',
    ],
  },
  {
    job: 'Validating Docs',
    name: 'docs-validate',
    cwd: baseUi,
    heavy: true,
    fullOnly: "regenerates docs-infra's API tables, about 11 minutes",
    generated: ['packages/base-ui/docs'],
    run: ['bun run docs:validate'],
  },
  {
    job: 'Validating Docs',
    name: 'docs-build',
    cwd: baseUi,
    heavy: true,
    fullOnly: 'the production docs build, about 15 minutes',
    after: 'docs-validate',
    run: ['bun run docs:build'],
  },
  {
    job: 'Validating Docs',
    name: 'docs-hydration',
    cwd: baseUi,
    heavy: true,
    fullOnly: 'crawls the docs build',
    exclusive: true,
    after: 'docs-build',
    run: ['bun run docs:check-hydration --serve'],
  },
  {
    job: 'Benchmark tests',
    name: 'benchmark',
    cwd: baseUi,
    heavy: true,
    fullOnly: 'builds the bench apps and runs every scenario',
    exclusive: true,
    // The measured run (`--full-bench`) takes about half an hour.
    timeoutSeconds: 3600,
    // Then the SSR interaction check (D29): each interactive SSR case once per library in
    // Chromium, failing on a dead trigger, a missing TTI or a page error, never on a timing.
    run: [
      'bun run bench:solid:build',
      'WARMUP=0 HEAP_RUNS=1 node test/perf-solid/run.mjs 1',
      'SSR_CHECK=chromium node --expose-gc test/perf-solid/ssr/run.mjs 1',
    ],
    fullRun: ['bun run bench:solid:build', 'bun run bench:solid', 'SSR_CHECK=chromium node --expose-gc test/perf-solid/ssr/run.mjs 1'],
  },
];

/** The Solid sources, repo-relative, and the folders parity compares (relative to packages/base-ui). */
const SOLID_SOURCES = `${solid}/src/`;
const SOLID_SRC = 'packages/solid/src';
const REACT_SRC = 'packages/react/src';
const TEST_FILE = /\.test\.tsx?$/;
/** Single-quotes `text` for the shell. */
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
/** Above this many Solid test files, a scoped parity run reports that it exceeds its budget. */
export const BROWSER_TEST_BUDGET = 40;

/**
 * The browser test files a range changed, relative to packages/base-ui, for the scoped parity
 * suites: each changed Solid test file under `packages/solid/src` that still exists, and every test
 * file beside a changed Solid source file (a library change can break a cross-browser test it did
 * not touch), each with its upstream counterpart when upstream has one. `names` are repo-relative;
 * `exists(file)` and `listDir(dir)` (a folder's files, not recursive) take paths relative to
 * packages/base-ui.
 */
export function changedBrowserTestFiles(names, exists, listDir) {
  const solidFiles = new Set();
  for (const name of names) {
    if (!name.startsWith(SOLID_SOURCES)) {
      continue;
    }
    const file = name.slice(baseUi.length + 1);
    if (TEST_FILE.test(file)) {
      if (exists(file)) {
        solidFiles.add(file);
      }
    } else {
      for (const sibling of listDir(path.posix.dirname(file))) {
        if (TEST_FILE.test(sibling)) {
          solidFiles.add(sibling);
        }
      }
    }
  }
  const files = new Set(solidFiles);
  for (const file of solidFiles) {
    const upstream = REACT_SRC + file.slice(SOLID_SRC.length);
    if (exists(upstream)) {
      files.add(upstream);
    }
  }
  return {
    files: [...files].sort(),
    solidCount: solidFiles.size,
    overBudget: solidFiles.size > BROWSER_TEST_BUDGET,
  };
}

/** The Solid docs routes, relative to packages/base-ui. */
const DOCS_ROUTES = 'docs/solid/src/app/(docs)/solid';
/** Changes the docs' generated files follow that no one page owns: the docs, their inputs, the lockfile. */
const DOCS_INPUTS = [`${baseUi}/docs/`, `${baseUi}/scripts/docs/`, 'bun.lock'];

/**
 * The docs pages a range can change, for a scoped docs-validate under `--changed`. A page's types
 * come from its component's entry (`types.ts` imports `@solidports/base-ui/<dir>`), so a source
 * change reaches the pages whose directory imports the changed one, directly or through other
 * directories. A change no page owns (shared code such as `utils/`, a file at the source root, the
 * docs or their inputs) reaches nearly every page: it returns as `full`, the full validation. Test
 * files reach none, and a change to a page's own files (its page, demos or generated types) reaches
 * that page. `names` are repo-relative; `graph.pages` maps a source directory to its route,
 * and `graph.importsOf(dir)` lists the source directories that dir's non-test files import.
 * @returns {{ full: string | null, pages: string[] }} `full`: the first change that needs the
 *   full validation
 */
export function changedDocsPages(names, graph) {
  const changedDirs = new Set();
  const routes = new Set(Object.values(graph.pages));
  /** Pages whose own files (page, demos, generated types) changed. */
  const touched = new Set();
  for (const name of names) {
    const route = [...routes].find((candidate) =>
      name.startsWith(`${baseUi}/docs/solid/src/app/${candidate}/`),
    );
    if (route) {
      touched.add(route);
      continue;
    }
    if (DOCS_INPUTS.some((input) => name === input || name.startsWith(input))) {
      return { full: name, pages: [] };
    }
    if (!name.startsWith(SOLID_SOURCES) || TEST_FILE.test(name)) {
      continue;
    }
    const rest = name.slice(SOLID_SOURCES.length);
    const dir = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : null;
    if (dir === null || !Object.hasOwn(graph.pages, dir)) {
      return { full: name, pages: [] };
    }
    changedDirs.add(dir);
  }
  const pages = [...touched];
  for (const [dir, route] of Object.entries(graph.pages)) {
    if (touched.has(route)) {
      continue;
    }
    // The directories this page's entry reaches, itself first.
    const reached = new Set([dir]);
    const queue = [dir];
    while (queue.length > 0) {
      for (const imported of graph.importsOf(queue.pop())) {
        if (!reached.has(imported)) {
          reached.add(imported);
          queue.push(imported);
        }
      }
    }
    if ([...changedDirs].some((changed) => reached.has(changed))) {
      pages.push(route);
    }
  }
  return { full: null, pages: pages.sort() };
}

/** Relative import specifiers: `from '...'`, `import('...')` and side-effect `import '...'`. */
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)'(\.{1,2}\/[^']+)'/g;

/**
 * The source directories one file imports from, other than its own: every relative specifier a
 * type can come through (`import`, `import type`, `export * from`, `export { x } from`,
 * `export type { x } from`, a side-effect `import`, a literal `import()`), resolved against the
 * file and cut to its first segment under `src`.
 */
export function importedDirs(source, file, src) {
  const own = path.relative(src, file).split(path.sep)[0];
  const dirs = new Set();
  for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
    const target = path.relative(src, path.resolve(path.dirname(file), specifier));
    const top = target.split(path.sep)[0].replace(/\.tsx?$/, '');
    if (!target.startsWith('..') && top !== own && top !== '') {
      dirs.add(top);
    }
  }
  return [...dirs];
}

/**
 * The docs graph on disk for `changedDocsPages`: each source directory with a component or utility
 * page, and the source directories each directory's non-test files import.
 */
export function docsGraph() {
  const src = path.join(root, SOLID_SOURCES);
  const routes = path.join(root, baseUi, DOCS_ROUTES);
  const pages = {};
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    for (const section of ['components', 'utils']) {
      if (entry.isDirectory() && fs.existsSync(path.join(routes, section, entry.name, 'page.mdx'))) {
        pages[entry.name] = `(docs)/solid/${section}/${entry.name}`;
      }
    }
  }
  const cache = new Map();
  const importsOf = (dir) => {
    if (!cache.has(dir)) {
      const imported = new Set();
      const base = path.join(src, dir);
      const files = fs.existsSync(base)
        ? fs.readdirSync(base, { recursive: true, withFileTypes: true }).filter(
            (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !TEST_FILE.test(entry.name),
          )
        : [];
      for (const file of files) {
        const at = path.join(file.parentPath, file.name);
        for (const dirName of importedDirs(fs.readFileSync(at, 'utf8'), at, src)) {
          imported.add(dirName);
        }
      }
      cache.set(dir, [...imported]);
    }
    return cache.get(dir);
  };
  return { pages, importsOf };
}

export function parseArgs(argv) {
  const options = { only: null, list: false, changed: null, fullBench: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--full-bench') {
      options.fullBench = true;
    } else if (arg === '--only') {
      options.only = argv[(index += 1)]?.split(',').filter(Boolean) ?? [];
    } else if (arg === '--changed') {
      const next = argv[index + 1];
      options.changed = next && !next.startsWith('--') ? argv[(index += 1)] : '';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/**
 * A parity suite's commands on `browserTests` alone (`changedBrowserTestFiles`): both suites run
 * only the selected files (an empty report stands in for a suite with none), and the check covers
 * only them. WebKit runs, reruns included, in Playwright's Docker image: local WebKit lacks the
 * host's libraries. The steps form one command, so the suite queues for the heavy lock once: a lock
 * per step queued each step behind every other gate (36 minutes for one test file on a busy lock).
 */
function scopedParity(browser, browserTests) {
  const report = (suite) => `"$TEST_ALL_RUN_DIR/${suite}-${browser}.json"`;
  const list = `"$TEST_ALL_RUN_DIR/browser-tests-${browser}.txt"`;
  const docker = browser === 'webkit';
  const suiteRun = (suite, script, dir) => {
    const files = browserTests.files.filter((file) => file.startsWith(`${dir}/`));
    if (files.length === 0) {
      return `printf '%s' '{"testResults":[]}' > ${report(suite)}`;
    }
    const filters = files.map(quote).join(' ');
    return docker
      ? `bash scripts/webkit-docker.sh ${script} ${report(suite)} ${filters} || true`
      : `bun run ${script} --run --maxWorkers=2 --reporter=json --outputFile=${report(suite)} ${filters} || true`;
  };
  return [
    `printf '%s\\n' ${browserTests.files.map(quote).join(' ')} > ${list}`,
    suiteRun('react', `test:${browser}`, REACT_SRC),
    suiteRun('solid', `test:solid:${browser}`, SOLID_SRC),
    `${docker ? 'PARITY_RUNNER=scripts/webkit-docker.sh ' : ''}node scripts/browser-parity.mjs ${report('react')} ${report('solid')} --confirm ${browser} --files ${list}`,
  ];
}

/**
 * The first library source file of a range's paths (relative to the repo root): a non-test file
 * under the Solid package's `src`, which selects the docs build and its hydration crawl under
 * `--changed`. Tests and SSR fixtures change no page; null when the range has none.
 */
export function changedLibrarySource(names) {
  const prefix = `${baseUi}/packages/solid/src/`;
  return (
    names.find(
      (name) =>
        name.startsWith(prefix) &&
        /\.(?:ts|tsx|js|jsx|mts|mjs|css)$/.test(name) &&
        !/\.(?:test|ssr-fixtures)\.[^/]+$/.test(name),
    ) ?? null
  );
}

/** The suites with this run's commands, each marked selected or not (with the reason). */
export function planSuites(options) {
  return suites.map((suite) => {
    let run = options.fullBench && suite.fullRun ? suite.fullRun : suite.run;
    let selected = true;
    let detail;
    let note;
    let unavailable;
    if (options.changed != null && suite.browser && options.browserTests) {
      // The scoped parity run: only the browser test files the range changed or sits beside.
      const tests = options.browserTests;
      if (tests.files.length === 0) {
        run = [];
        note = 'no browser test file changed';
      } else {
        run = [scopedParity(suite.browser, tests).join('\n')];
        note = `${tests.solidCount} Solid test files${tests.overBudget ? `, over the ${BROWSER_TEST_BUDGET}-file budget` : ''}`;
      }
    } else if (options.changed != null && suite.name === 'docs-validate' && options.docsPages) {
      // The scoped docs validation: one run per page the range can change, or the full one.
      const { full, pages } = options.docsPages;
      if (full) {
        note = `full: ${full} reaches every page`;
      } else if (pages.length > 0) {
        run = pages.map((page) => `bun run docs:validate ${quote(page)}`);
        note = `${pages.length} page${pages.length === 1 ? '' : 's'}: ${pages.join(', ')}`;
      } else {
        selected = false;
        detail = 'not selected (--changed: no docs page reached)';
      }
    } else if (
      options.changed != null &&
      (suite.name === 'docs-build' || suite.name === 'docs-hydration') &&
      options.librarySource
    ) {
      // The production docs build and its hydration crawl, whole (about 5 minutes together): a
      // library source change can break a page's hydration that no unit fixture has the shape of.
      note = `library source changed: ${options.librarySource}`;
    } else if (options.changed != null) {
      selected = !suite.heavy || Boolean(suite.vitest);
      detail = selected ? undefined : `not selected (--changed: ${suite.fullOnly})`;
      if (suite.vitest) {
        const since = options.changed ? ` ${options.changed}` : '';
        // Only the vitest commands: a quick diff run skips the preparation steps (`types`).
        run = run
          .filter((command) => command.startsWith('bun run test:solid:'))
          .map((command) => `${command} --changed${since} --passWithNoTests`);
      }
    }
    if (selected && options.only && !options.only.includes(suite.name)) {
      selected = false;
      detail = 'not selected (--only)';
    }
    if (selected && suite.browser === 'webkit' && run.length > 0 && options.dockerUnavailable) {
      unavailable = options.dockerUnavailable;
    }
    return {
      ...suite,
      run,
      selected,
      ...(detail ? { detail } : {}),
      ...(note ? { note } : {}),
      ...(unavailable ? { unavailable } : {}),
    };
  });
}

/**
 * The run's exit code: 1 when a suite failed, and under `--changed` also when a suite the range
 * selected did not run (a suite that did not run is not a pass). A full run reports a suite the
 * machine cannot run (error-codes without pnpm) as not run without failing on it.
 */
export function exitCodeFor(results, options) {
  if (results.some((result) => result.status === 'fail')) {
    return 1;
  }
  if (
    options.changed != null &&
    results.some((result) => result.status === 'not run' && result.suite.selected)
  ) {
    return 1;
  }
  return 0;
}

/**
 * Runs the selected suites with `run(suite)` under the concurrency rules and resolves to one result
 * per suite, in declaration order.
 */
export async function runAll(planned, run, limits) {
  const results = new Map();
  const finished = new Set();
  const pending = [];
  for (const suite of planned) {
    if (suite.selected) {
      pending.push(suite);
    } else {
      results.set(suite, { suite, status: 'not run', detail: suite.detail, seconds: 0 });
      finished.add(suite.name);
    }
  }
  const active = { heavy: 0, light: 0, exclusive: 0 };
  await new Promise((resolve) => {
    const startReady = () => {
      for (const suite of [...pending]) {
        if (suite.after && !finished.has(suite.after)) continue;
        if (suite.exclusive && active.exclusive >= 1) continue;
        if (suite.heavy ? active.heavy >= limits.heavy : active.light >= limits.light) continue;
        pending.splice(pending.indexOf(suite), 1);
        active[suite.heavy ? 'heavy' : 'light'] += 1;
        if (suite.exclusive) active.exclusive += 1;
        const start = Date.now();
        Promise.resolve(run(suite))
          .catch((error) => ({ status: 'fail', detail: String(error?.message ?? error) }))
          .then((result) => {
            active[suite.heavy ? 'heavy' : 'light'] -= 1;
            if (suite.exclusive) active.exclusive -= 1;
            results.set(suite, {
              suite,
              ...result,
              seconds: Math.round((Date.now() - start) / 1000),
            });
            finished.add(suite.name);
            if (pending.length === 0 && active.heavy + active.light === 0) resolve();
            else startReady();
          });
      }
      if (pending.length === 0 && active.heavy + active.light === 0) resolve();
    };
    startReady();
  });
  return planned.map((suite) => results.get(suite));
}

/** This run's log folder. */
export function runDirFor(repoRoot, date) {
  return path.join(repoRoot, '.tmp/base-ui-test-all', date.toISOString().replace(/[:.]/g, '-'));
}

/**
 * Takes the per-tree run lock, or rejects naming the PID of the run that holds it. A holder process
 * keeps the flock while this process lives, so a crashed run cannot strand it; `release` ends the
 * holder's whole process group (the flock and the shell that inherited its descriptor).
 */
export function acquireRunLock(lock) {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const pidFile = `${lock}.pid`;
  return new Promise((resolve, reject) => {
    const holder = spawn(
      'flock',
      [
        '-n',
        // The shell below must not inherit the lock: then the lock is free once the holder exits.
        '-o',
        '-E',
        '75',
        lock,
        'sh',
        '-c',
        `echo locked; while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done`,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], detached: true },
    );
    const stop = () => {
      try {
        process.kill(-holder.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    };
    holder.stdout.once('data', () => {
      fs.writeFileSync(pidFile, String(process.pid));
      process.once('exit', stop);
      resolve({
        release: () =>
          new Promise((done) => {
            process.removeListener('exit', stop);
            holder.once('exit', () => done());
            stop();
          }),
      });
    });
    holder.once('exit', (code) => {
      if (code === 75) {
        const pid = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : 'unknown';
        reject(
          new Error(
            `another test:base-ui:all run holds ${lock} (pid ${pid}); wait for it or stop it`,
          ),
        );
      }
    });
  });
}

function treeState(paths) {
  const git = (args) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }).stdout;
  return (
    git(['status', '--porcelain=v1', '-uall', '--', ...paths]) +
    git(['diff', '--binary', '--', ...paths])
  );
}

function changedPaths(before, after) {
  const lines = (state) => new Set(state.split('\n').filter((line) => /^.. /.test(line)));
  const previous = lines(before);
  return [...lines(after)].filter((line) => !previous.has(line)).map((line) => line.slice(3));
}

/**
 * The shell command for one step: under the machine lock, with a timeout, when the suite is
 * exclusive.
 */
export function commandFor(suite, command, lock = EXCLUSIVE_LOCK) {
  if (!suite.exclusive) return command;
  const l = quote(lock);
  const seconds = suite.timeoutSeconds ?? LOCK_TIMEOUT_SECONDS;
  return `mkdir -p ${quote(path.dirname(lock))}; flock -n ${l} true || echo "test-all: waiting for ${lock} (another gate holds it)"; flock ${l} timeout -k 30 ${seconds} sh -c ${quote(command)}`;
}

/**
 * Why `command` failed with exit `code`: the timeout that killed an exclusive suite's command
 * (`timeout` exits 124), or the command's last step, whose status a multi-step command (scoped
 * parity) returns.
 */
export function failureDetail(suite, command, code) {
  if (suite.exclusive && code === 124) {
    return `timed out after ${suite.timeoutSeconds ?? LOCK_TIMEOUT_SECONDS} s`;
  }
  return `\`${command.split('\n').at(-1)}\` failed`;
}

/** Runs `command`, appending its output to `log`; resolves its exit code. */
function runCommand(command, cwd, log, runDir) {
  fs.appendFileSync(log, `\n$ ${command}\n`);
  const fd = fs.openSync(log, 'a');
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: path.join(root, cwd),
      env: { ...process.env, TEST_ALL_RUN_DIR: runDir },
      shell: true,
      stdio: ['ignore', fd, fd],
    });
    child.on('close', (code) => {
      fs.closeSync(fd);
      resolve(code);
    });
  });
}

/**
 * Why a vitest suite's log does not show a complete run, or `undefined` when every run in it
 * reached all of its test files. A run that ends early (a browser that lost its iframe, a run cut
 * off) can still exit 0 with files that never ran: every \`Test Files\` summary must account for
 * all of its files (passed, failed, skipped or todo), and a log with none is incomplete too, unless
 * the suite runs with `--passWithNoTests` (`--changed`) and vitest found no test file to run.
 * @param {string} log
 * @param {{ passWithNoTests?: boolean }} [options]
 * @returns {string | undefined}
 */
export function vitestIncomplete(log, options = {}) {
  // eslint-disable-next-line no-control-regex -- vitest colors its summary with ANSI escapes
  const plain = log.replace(/\u001b\[[0-9;]*m/g, '');
  const summaries = [...plain.matchAll(/^\s*Test Files\s+(.*?)\s*\((\d+)\)\s*$/gm)];
  if (summaries.length === 0) {
    if (options.passWithNoTests && /^No test files found, exiting with code 0$/m.test(plain)) {
      return undefined;
    }
    return 'no vitest summary in the log';
  }
  for (const [, counts, total] of summaries) {
    const reached = [...counts.matchAll(/(\d+)\s+(?:passed|failed|skipped|todo)/g)].reduce(
      (sum, [, n]) => sum + Number(n),
      0,
    );
    if (reached < Number(total)) {
      return `ran ${reached} of ${total} test files`;
    }
  }
  return undefined;
}

async function runSuite(suite, runDir) {
  const log = path.join(runDir, `${suite.name}.log`);
  fs.writeFileSync(log, '');
  if (suite.unavailable) {
    return { status: 'not run', detail: suite.unavailable };
  }
  console.log(`▶ ${suite.job} / ${suite.name}`);
  const before = suite.generated ? treeState(suite.generated) : null;
  for (const command of suite.run) {
    // eslint-disable-next-line no-await-in-loop -- a suite's commands run in order
    const code = await runCommand(commandFor(suite, command), suite.cwd, log, runDir);
    if (code !== 0) {
      return { status: 'fail', detail: failureDetail(suite, command, code) };
    }
  }
  if (suite.vitest) {
    const incomplete = vitestIncomplete(fs.readFileSync(log, 'utf8'), {
      passWithNoTests: suite.run.every((command) => command.includes('--passWithNoTests')),
    });
    if (incomplete) {
      return { status: 'fail', detail: `incomplete: ${incomplete}` };
    }
  }
  if (before !== null) {
    const after = treeState(suite.generated);
    if (after !== before) {
      const paths = changedPaths(before, after);
      return {
        status: 'fail',
        detail: `changed the tree: ${paths.length > 0 ? paths.join(', ') : 'modified files'}`,
      };
    }
  }
  return { status: 'pass', detail: suite.note ?? '' };
}

/**
 * The scoped parity suites' inputs under `--changed`: the range's browser test files (the diff
 * against the ref, the working tree included, plus untracked files) and whether Docker can run
 * WebKit.
 */
function scopedParityInputs(ref) {
  const git = (args) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const names = [
    ...git(['diff', '--name-only', ref || 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
  const base = path.join(root, baseUi);
  const docsPages = changedDocsPages(names, docsGraph());
  const librarySource = changedLibrarySource(names);
  const browserTests = changedBrowserTestFiles(
    names,
    (file) => fs.existsSync(path.join(base, file)),
    (dir) =>
      fs.existsSync(path.join(base, dir))
        ? fs
            .readdirSync(path.join(base, dir), { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => `${dir}/${entry.name}`)
        : [],
  );
  return { browserTests, docsPages, librarySource };
}

/**
 * Why Docker cannot run WebKit, from `docker info`'s result, or null when it can. A socket that
 * exists but refuses this user is a missing docker group, which a re-login (or `newgrp docker` for
 * one shell) fixes.
 */
export function dockerUnavailable(info, socketExists) {
  if (info.status === 0) return null;
  if (socketExists && /permission denied/i.test(info.stderr ?? '')) {
    return 'Docker permission: re-login or newgrp docker';
  }
  return 'Docker is not available for WebKit';
}

/** `dockerUnavailable` for this shell: runs `docker info` and checks its socket. */
function probeDocker() {
  const info = spawnSync('docker', ['info'], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  const host = process.env.DOCKER_HOST ?? 'unix:///var/run/docker.sock';
  const socket = host.startsWith('unix://') ? host.slice('unix://'.length) : null;
  return dockerUnavailable(info, socket !== null && fs.existsSync(socket));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (options.list) {
    for (const suite of suites) {
      console.log(`${suite.name.padEnd(20)} ${suite.job}`);
    }
    process.exit(0);
  }
  const unknown = (options.only ?? []).filter(
    (name) => !suites.some((suite) => suite.name === name),
  );
  if (unknown.length > 0) {
    console.error(`Unknown suite: ${unknown.join(', ')} (see --list)`);
    process.exit(2);
  }

  let runLock;
  try {
    runLock = await acquireRunLock(path.join(logRoot, 'run.lock'));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const runDir = runDirFor(root, new Date());
  fs.mkdirSync(runDir, { recursive: true });
  const latest = path.join(logRoot, 'latest');
  fs.rmSync(latest, { force: true });
  fs.symlinkSync(path.basename(runDir), latest);
  console.log(`logs: ${path.relative(root, runDir)}/`);
  const limits = {
    heavy: Number(process.env.GATES_HEAVY ?? 2),
    light: Number(process.env.GATES_LIGHT ?? 4),
  };
  const started = Date.now();
  if (options.changed != null) {
    Object.assign(options, scopedParityInputs(options.changed));
  }
  // Only when the WebKit suite can be selected: `--only` without it skips the probe.
  if (!options.only || options.only.includes('parity-webkit')) {
    options.dockerUnavailable = probeDocker();
  }
  const results = await runAll(
    planSuites(options),
    async (suite) => {
      const result = await runSuite(suite, runDir);
      console.log(
        `  ${suite.name}: ${result.status}${result.detail ? ` (${result.detail})` : ''} in ${Math.round((Date.now() - started) / 1000)}s since start`,
      );
      return result;
    },
    limits,
  );

  const count = (status) => results.filter((result) => result.status === status).length;
  console.log(
    `\n${count('fail')} failed, ${count('pass')} passed, ${count('not run')} not run, of ${results.length} suites in ${Math.round((Date.now() - started) / 1000)}s (heavy ${limits.heavy}, light ${limits.light})\n`,
  );
  for (const result of results) {
    const log =
      result.status === 'fail' ? ` → ${path.relative(root, runDir)}/${result.suite.name}.log` : '';
    console.log(
      `${result.status.padEnd(8)} ${result.suite.name.padEnd(20)} ${result.suite.job}${result.detail ? ` (${result.detail})` : ''}${log}`,
    );
  }
  await runLock.release();
  process.exit(exitCodeFor(results, options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
