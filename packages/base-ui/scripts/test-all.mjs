/* eslint-disable no-console */
// Runs every suite the "Base UI tests" workflow (.github/workflows/base-ui-tests.yml) runs, one
// after another, with the same commands, then prints each suite's result and exits 1 when any
// failed. A suite that cannot run on this machine is reported as "not run", never left out.
// Logs go to .tmp/base-ui-test-all/<suite>.log at the monorepo root.
//
// Usage (from the monorepo root): bun run test:base-ui:all [--only <suite>,<suite>] [--list]
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const baseUi = 'packages/base-ui';
const solid = 'packages/base-ui/packages/solid';
const logDir = path.join(root, '.tmp/base-ui-test-all');

// One entry per workflow step, grouped by job. `generated` fails the step when it changes the
// working tree (the workflow's `git diff --exit-code`, without discarding local changes first).
const suites = [
  { job: 'Linting', name: 'format', cwd: '.', run: ['bun run fmt:check'] },
  { job: 'Linting', name: 'oxlint', cwd: '.', run: ['bun run lint'] },
  {
    job: 'Linting',
    name: 'eslint',
    cwd: baseUi,
    run: [
      'bunx eslint packages/solid/src packages/solid/test docs/solid/src --report-unused-disable-directives --max-warnings 0',
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
  { job: 'Linting', name: 'vale', cwd: baseUi, run: ['bun run valelint'] },
  {
    job: 'Generated files',
    name: 'error-codes',
    cwd: baseUi,
    generated: true,
    run: ['bun run extract-error-codes'],
  },
  {
    job: 'Generated files',
    name: 'inline-scripts',
    cwd: baseUi,
    generated: true,
    run: ['bun run inline-scripts'],
  },
  { job: 'Generated files', name: 'test-parity', cwd: baseUi, run: ['node scripts/test-parity.mjs'] },
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
    run: ['bun run release:test'],
  },
  {
    job: 'Package',
    name: 'node-resolution',
    cwd: 'packages/base-ui/test/node-resolution-solid',
    run: ['bun run test'],
  },
  {
    job: 'JSDOM tests',
    name: 'jsdom',
    cwd: baseUi,
    run: ['bun run test:solid:jsdom --run --maxWorkers=2'],
  },
  {
    job: 'Browser tests',
    name: 'chromium',
    cwd: baseUi,
    run: ['bun run test:solid:chromium --run --maxWorkers=2'],
  },
  // The browser parity workflow: upstream's suite and the Solid suite in Firefox and WebKit, failing
  // on Solid-only failures (upstream's CI runs neither browser).
  ...['firefox', 'webkit'].map((browser) => ({
    job: 'Browser parity',
    name: `parity-${browser}`,
    cwd: baseUi,
    run: [
      `bun run test:${browser} --run --maxWorkers=2 --reporter=json --outputFile=../../.tmp/base-ui-test-all/react-${browser}.json || true`,
      `bun run test:solid:${browser} --run --maxWorkers=2 --reporter=json --outputFile=../../.tmp/base-ui-test-all/solid-${browser}.json || true`,
      `node scripts/browser-parity.mjs ../../.tmp/base-ui-test-all/react-${browser}.json ../../.tmp/base-ui-test-all/solid-${browser}.json --confirm ${browser}`,
    ],
  })),
  { job: 'E2E tests', name: 'e2e', cwd: baseUi, run: ['bun run test:e2e:solid'] },
  {
    job: 'Regression tests',
    name: 'regressions',
    cwd: baseUi,
    run: ['bun run test:regressions:solid:build', 'bun run test:regressions:solid'],
  },
  {
    job: 'Screen Reader',
    name: 'screen-reader',
    cwd: baseUi,
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
    generated: true,
    run: ['bun run docs:validate'],
  },
  { job: 'Validating Docs', name: 'docs-build', cwd: baseUi, run: ['bun run docs:build'] },
  {
    job: 'Validating Docs',
    name: 'docs-hydration',
    cwd: baseUi,
    run: ['bun run docs:check-hydration --serve'],
  },
  {
    job: 'Benchmark tests',
    name: 'benchmark',
    cwd: baseUi,
    run: ['bun run bench:solid:build', 'bun run bench:solid'],
  },
];

function parseArgs(argv) {
  const options = { only: null, list: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--list') {
      options.list = true;
    } else if (argv[index] === '--only') {
      options.only = argv[(index += 1)]?.split(',').filter(Boolean) ?? [];
    } else {
      console.error(`Unknown argument: ${argv[index]}`);
      process.exit(2);
    }
  }
  return options;
}

function treeState() {
  const git = (args) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }).stdout;
  return git(['status', '--porcelain=v1', '-uall']) + git(['diff', '--binary']);
}

function changedPaths(before, after) {
  const lines = (state) => new Set(state.split('\n').filter((line) => /^.. /.test(line)));
  const previous = lines(before);
  return [...lines(after)].filter((line) => !previous.has(line)).map((line) => line.slice(3));
}

function runCommand(command, cwd, log) {
  fs.appendFileSync(log, `\n$ ${command}\n`);
  const fd = fs.openSync(log, 'a');
  const result = spawnSync(command, {
    cwd: path.join(root, cwd),
    shell: true,
    stdio: ['ignore', fd, fd],
  });
  fs.closeSync(fd);
  return result.status === 0;
}

function runSuite(suite) {
  const log = path.join(logDir, `${suite.name}.log`);
  fs.writeFileSync(log, '');
  if (suite.unavailable) {
    return { status: 'not run', detail: suite.unavailable };
  }

  const before = suite.generated ? treeState() : null;
  for (const command of suite.run) {
    if (!runCommand(command, suite.cwd, log)) {
      return { status: 'fail', detail: `\`${command}\` failed` };
    }
  }
  if (before !== null) {
    const after = treeState();
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

const options = parseArgs(process.argv.slice(2));
if (options.list) {
  for (const suite of suites) {
    console.log(`${suite.name.padEnd(20)} ${suite.job}`);
  }
  process.exit(0);
}
const unknown = (options.only ?? []).filter((name) => !suites.some((suite) => suite.name === name));
if (unknown.length > 0) {
  console.error(`Unknown suite: ${unknown.join(', ')} (see --list)`);
  process.exit(2);
}

fs.mkdirSync(logDir, { recursive: true });
const results = [];
for (const suite of suites) {
  if (options.only && !options.only.includes(suite.name)) {
    results.push({ suite, status: 'not run', detail: 'not selected (--only)', seconds: 0 });
    continue;
  }
  console.log(`▶ ${suite.job} / ${suite.name}`);
  const start = Date.now();
  const result = runSuite(suite);
  const seconds = Math.round((Date.now() - start) / 1000);
  results.push({ suite, ...result, seconds });
  console.log(`  ${result.status}${result.detail ? ` (${result.detail})` : ''} in ${seconds}s`);
}

const count = (status) => results.filter((result) => result.status === status).length;
console.log(
  `\n${count('fail')} failed, ${count('pass')} passed, ${count('not run')} not run, of ${results.length} suites\n`,
);
for (const result of results) {
  const log =
    result.status === 'fail' ? ` → .tmp/base-ui-test-all/${result.suite.name}.log` : '';
  console.log(
    `${result.status.padEnd(8)} ${result.suite.name.padEnd(20)} ${result.suite.job}${result.detail ? ` (${result.detail})` : ''}${log}`,
  );
}
process.exit(count('fail') > 0 ? 1 : 0);
