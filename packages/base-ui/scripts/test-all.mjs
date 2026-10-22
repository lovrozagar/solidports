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
//   bun run test:base-ui:all --changed [ref]   jsdom and chromium on vitest's module-graph diff
//                                              against HEAD (uncommitted changes) or the ref
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

// One entry per workflow step, grouped by job. `generated` lists the paths the step may rewrite;
// it fails when it changes any of them (the workflow's `git diff --exit-code`, scoped so suites
// running beside it cannot be blamed on it, and without discarding local changes first).
// `heavy` suites count against GATES_HEAVY; `after` names the suite this one waits for.
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
    // Run whole by `--changed` too: the verify stamp runs the repository's lint, not this one.
    changed: true,
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
    // Run by `--changed` when the range changes Base UI's Markdown: the verify stamp lints no prose,
    // and an edited note failed CI's vale step (2c766d1e).
    changedFiles: /^packages\/base-ui\/.*\.mdx?$/,
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
    // Run by `--changed` too: the verify stamp never extracts the codes, and a new `Error` pushed
    // without its code failed CI (9a9f246b).
    changed: true,
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
    // Run by `--changed` too: the verify stamp never regenerates the docs, and an edit to their
    // generated output failed CI (fadd8eb5).
    changed: true,
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
  // on Solid-only failures (upstream's CI runs neither browser).
  ...['firefox', 'webkit'].map((browser) => ({
    job: 'Browser parity',
    name: `parity-${browser}`,
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    run: [
      `bun run test:${browser} --run --maxWorkers=2 --reporter=json --outputFile="$TEST_ALL_RUN_DIR/react-${browser}.json" || true`,
      `bun run test:solid:${browser} --run --maxWorkers=2 --reporter=json --outputFile="$TEST_ALL_RUN_DIR/solid-${browser}.json" || true`,
      `node scripts/browser-parity.mjs "$TEST_ALL_RUN_DIR/react-${browser}.json" "$TEST_ALL_RUN_DIR/solid-${browser}.json" --confirm ${browser}`,
    ],
  })),
  {
    job: 'E2E tests',
    name: 'e2e',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    run: ['bun run test:e2e:solid'],
  },
  {
    job: 'Regression tests',
    name: 'regressions',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    run: ['bun run test:regressions:solid:build', 'bun run test:regressions:solid'],
  },
  {
    job: 'Screen Reader',
    name: 'screen-reader',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
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
    generated: ['packages/base-ui/docs'],
    run: ['bun run docs:validate'],
  },
  {
    job: 'Validating Docs',
    name: 'docs-build',
    cwd: baseUi,
    heavy: true,
    after: 'docs-validate',
    run: ['bun run docs:build'],
  },
  {
    job: 'Validating Docs',
    name: 'docs-hydration',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    after: 'docs-build',
    run: ['bun run docs:check-hydration --serve'],
  },
  {
    job: 'Benchmark tests',
    name: 'benchmark',
    cwd: baseUi,
    heavy: true,
    exclusive: true,
    // The measured run (`--full-bench`) takes about half an hour.
    timeoutSeconds: 3600,
    run: ['bun run bench:solid:build', 'WARMUP=0 HEAP_RUNS=1 node test/perf-solid/run.mjs 1'],
    fullRun: ['bun run bench:solid:build', 'bun run bench:solid'],
  },
];

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

/** The suites with this run's commands, each marked selected or not (with the reason). */
export function planSuites(options) {
  return suites.map((suite) => {
    let run = options.fullBench && suite.fullRun ? suite.fullRun : suite.run;
    let selected = true;
    let detail;
    if (options.changed != null) {
      selected = Boolean(
        suite.vitest ||
          suite.changed ||
          (suite.changedFiles &&
            (options.changedFiles ?? []).some((file) => suite.changedFiles.test(file))),
      );
      detail = selected ? undefined : 'not selected (--changed)';
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
    return { ...suite, run, selected, ...(detail ? { detail } : {}) };
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

const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;

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
      resolve(code === 0);
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
    if (!(await runCommand(commandFor(suite, command), suite.cwd, log, runDir))) {
      return { status: 'fail', detail: `\`${command}\` failed` };
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
  return { status: 'pass', detail: '' };
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
    // The files the range changes, committed or not: suites that run only for some files read them.
    const diff = spawnSync('git', ['diff', '--name-only', options.changed || 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    });
    options.changedFiles = diff.status === 0 ? diff.stdout.split('\n').filter(Boolean) : [];
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
