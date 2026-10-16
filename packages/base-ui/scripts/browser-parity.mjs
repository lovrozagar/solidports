/* eslint-disable no-console */
// Compares upstream's (React) and the Solid suite's results in one browser, from Vitest JSON
// reports: prints the Solid failures of tests upstream passes there ("Solid-only"), then the
// counts, and exits 1 when there is any. A test failing in both is the browser's or the test
// environment's, not the port's.
//
// With `--confirm <browser>`, the files of the Solid-only failures run again for both suites
// (CONFIRM_RUNS times). A failure is confirmed when Solid fails it in every rerun and upstream
// passes it in one (or upstream has no such test); the others are listed as flaky. Only confirmed
// failures fail the check, so one-off browser timing in either suite does not.
//
// Each report must cover its suite: every test file on disk under its source folder ran at least
// one test (passed, failed or skipped). A run that never started, or a file that failed to load,
// fails the check on its own, so it can neither pass nor pass for Solid-only failures.
//
// Usage: node scripts/browser-parity.mjs <react-report.json> <solid-report.json> [--confirm <browser>]
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIRM_RUNS = 2;

function results(reportPath, sourceRoot) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const tests = new Map();
  for (const file of report.testResults) {
    const name = file.name
      .split(sourceRoot)
      .pop()
      .replace(/\.(test|spec)\.tsx?$/, '')
      .replace('floating-ui-react', 'floating-ui-solid');
    for (const assertion of file.assertionResults) {
      const title = [...assertion.ancestorTitles, assertion.title].join(' > ');
      tests.set(`${name} :: ${title}`, {
        file: file.name,
        status: assertion.status,
        message: (assertion.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 200),
      });
    }
  }
  return tests;
}

/** The test files on disk under `dir` (relative to it) that `reportPath` ran no test in. */
function unrunFiles(reportPath, dir) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const ran = new Set();
  for (const file of report.testResults) {
    const index = file.name.indexOf(`${dir}/`);
    if (index !== -1 && file.assertionResults.length > 0) {
      ran.add(file.name.slice(index + dir.length + 1));
    }
  }
  const onDisk = fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.test\.tsx?$/.test(file));
  return { total: onDisk.length, missing: onDisk.filter((file) => !ran.has(file)).sort() };
}

/** Runs one suite's test files again with a JSON report; returns the parsed results. */
function rerun(script, files, sourceRoot) {
  const outputFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parity-')), 'report.json');
  spawnSync(
    'bun',
    ['run', script, '--run', '--reporter=json', `--outputFile=${outputFile}`, ...files],
    { stdio: 'ignore' },
  );
  return fs.existsSync(outputFile) ? results(outputFile, sourceRoot) : new Map();
}

const args = process.argv.slice(2);
const confirmIndex = args.indexOf('--confirm');
const browser = confirmIndex === -1 ? null : args[confirmIndex + 1];
const [reactPath, solidPath] =
  confirmIndex === -1
    ? args
    : args.filter((_, index) => index !== confirmIndex && index !== confirmIndex + 1);
if (!reactPath || !solidPath || (confirmIndex !== -1 && !browser)) {
  console.error(
    'Usage: node scripts/browser-parity.mjs <react-report.json> <solid-report.json> [--confirm <browser>]',
  );
  process.exit(2);
}

for (const [suite, reportPath, dir] of [
  ['upstream', reactPath, 'packages/react/src'],
  ['Solid', solidPath, 'packages/solid/src'],
]) {
  const { total, missing } = unrunFiles(reportPath, dir);
  if (missing.length > 0) {
    console.error(
      `${suite} ran tests in ${total - missing.length} of ${total} test files under ${dir}; the run is incomplete, so the comparison would be meaningless. Files without a test result:\n${missing
        .slice(0, 20)
        .map((file) => `  ${file}`)
        .join('\n')}${missing.length > 20 ? `\n  … and ${missing.length - 20} more` : ''}`,
    );
    process.exit(1);
  }
}

const react = results(reactPath, 'packages/react/src/');
const solid = results(solidPath, 'packages/solid/src/');

let solidOnly = [];
let shared = 0;
let solidFailures = 0;
for (const [key, result] of solid) {
  if (result.status !== 'failed') {
    continue;
  }
  solidFailures += 1;
  if (react.get(key)?.status === 'failed') {
    shared += 1;
  } else {
    solidOnly.push({ key, message: result.message, upstream: react.get(key)?.status ?? 'absent' });
  }
}
const upstreamOnly = [...react].filter(
  ([key, result]) => result.status === 'failed' && solid.get(key)?.status === 'passed',
).length;

const flaky = [];
if (browser && solidOnly.length > 0) {
  const relative = (file) => path.relative(process.cwd(), file);
  const solidFiles = [...new Set(solidOnly.map(({ key }) => relative(solid.get(key).file)))];
  const reactFiles = [
    ...new Set(
      solidOnly
        .map(({ key }) => react.get(key)?.file)
        .filter(Boolean)
        .map(relative),
    ),
  ];
  const solidRuns = [];
  const reactRuns = [];
  for (let attempt = 0; attempt < CONFIRM_RUNS; attempt += 1) {
    solidRuns.push(rerun(`test:solid:${browser}`, solidFiles, 'packages/solid/src/'));
    if (reactFiles.length > 0) {
      reactRuns.push(rerun(`test:${browser}`, reactFiles, 'packages/react/src/'));
    }
  }
  const confirmed = [];
  for (const entry of solidOnly) {
    const solidAlwaysFails = solidRuns.every((run) => run.get(entry.key)?.status === 'failed');
    const upstreamPasses =
      entry.upstream === 'absent' || reactRuns.some((run) => run.get(entry.key)?.status === 'passed');
    (solidAlwaysFails && upstreamPasses ? confirmed : flaky).push(entry);
  }
  solidOnly = confirmed;
}

for (const { key, message, upstream } of solidOnly.sort((a, b) => a.key.localeCompare(b.key))) {
  console.log(`- [upstream: ${upstream}] ${key}\n    ${message}`);
}
for (const { key } of flaky) {
  console.log(`- flaky (not confirmed in ${CONFIRM_RUNS} reruns): ${key}`);
}
console.log(
  `\nSolid failures: ${solidFailures}; shared with upstream: ${shared}; Solid-only: ${solidOnly.length}${
    browser ? `; flaky: ${flaky.length}` : ''
  }; upstream failures Solid passes: ${upstreamOnly}`,
);
process.exit(solidOnly.length > 0 ? 1 : 0);
