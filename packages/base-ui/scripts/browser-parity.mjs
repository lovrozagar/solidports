/* eslint-disable no-console */
// Compares upstream's (React) and the Solid suite's results in one browser, from Vitest JSON
// reports: prints the Solid failures of tests upstream passes there ("Solid-only"), then the
// counts, and exits 1 when there is any. A test failing in both is the browser's or the test
// environment's, not the port's.
//
// With `--confirm <browser>`, the files of the Solid-only failures run again for both suites
// (CONFIRM_RUNS times). A failure is confirmed when Solid fails it in every rerun and fails it
// significantly more often than upstream: a one-sided Fisher exact p under ALPHA (or upstream has
// no such test). A failure Solid failed in every rerun that the reruns cannot settle runs 10 more
// times, all such files together, and is decided at MAX_CONFIRM_RUNS. The rest are listed as not
// confirmed; every line prints both counts and p. Only confirmed failures fail the check. On CI's
// WebKit both suites fail some tests in many runs (upstream fails Popover's Enter-or-Space test
// in 7 of 10 reruns), so a rule that needs only one passing upstream rerun confirms by chance.
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
import { fileURLToPath } from 'node:url';

/** Reruns per suite in the first stage; a Solid flake failing 60% of runs passes one of them but 0.6%. */
export const CONFIRM_RUNS = 10;
/** Reruns per suite after the second stage, for failures the first could not settle. */
export const MAX_CONFIRM_RUNS = 20;
/** The p a confirmed failure stays under at each look (two looks: at most 2% per test). */
export const ALPHA = 0.01;

const choose = (n, k) => {
  let value = 1;
  for (let i = 0; i < k; i += 1) {
    value = (value * (n - i)) / (i + 1);
  }
  return value;
};

/**
 * The one-sided Fisher exact p that Solid fails at least `solidFailed` of `solidRuns` reruns
 * when both suites share one failure rate, given upstream failed `upstreamFailed` of
 * `upstreamRuns`.
 */
export function fisherOneSided(solidFailed, solidRuns, upstreamFailed, upstreamRuns) {
  const failures = solidFailed + upstreamFailed;
  const total = solidRuns + upstreamRuns;
  let p = 0;
  for (let x = solidFailed; x <= Math.min(solidRuns, failures); x += 1) {
    p += (choose(failures, x) * choose(total - failures, solidRuns - x)) / choose(total, solidRuns);
  }
  return Math.min(1, p);
}

/**
 * Splits Solid-only failures (`{ key, upstream }`) by the reruns of both suites (maps from test
 * key to result): confirmed when Solid fails the test in every rerun and the one-sided Fisher
 * exact p of Solid failing more than upstream is under ALPHA (or upstream has no such test). Each
 * entry gets `solidFailed`, `upstreamPassed`, `runs` and `p`, and `inconclusive` when Solid failed
 * every rerun but fewer than MAX_CONFIRM_RUNS ran and p is not yet under ALPHA.
 */
export function confirm(entries, solidRuns, reactRuns) {
  const confirmed = [];
  const unconfirmed = [];
  for (const entry of entries) {
    const runs = solidRuns.length;
    const solidFailed = solidRuns.filter((run) => run.get(entry.key)?.status === 'failed').length;
    const upstreamFailed = reactRuns.filter(
      (run) => run.get(entry.key)?.status === 'failed',
    ).length;
    const upstreamPassed = reactRuns.filter(
      (run) => run.get(entry.key)?.status === 'passed',
    ).length;
    const absent = entry.upstream === 'absent';
    const p = absent ? 0 : fisherOneSided(solidFailed, runs, upstreamFailed, reactRuns.length);
    const solidAlwaysFails = solidFailed === runs;
    const isConfirmed = solidAlwaysFails && (absent || p < ALPHA);
    const counted = {
      ...entry,
      solidFailed,
      upstreamPassed,
      runs,
      p,
      inconclusive: solidAlwaysFails && !isConfirmed && runs < MAX_CONFIRM_RUNS,
    };
    (isConfirmed ? confirmed : unconfirmed).push(counted);
  }
  return { confirmed, unconfirmed };
}

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

function main() {
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
    return 2;
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
      return 1;
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
      solidOnly.push({
        key,
        message: result.message,
        upstream: react.get(key)?.status ?? 'absent',
      });
    }
  }
  const upstreamOnly = [...react].filter(
    ([key, result]) => result.status === 'failed' && solid.get(key)?.status === 'passed',
  ).length;

  const unconfirmed = [];
  if (browser && solidOnly.length > 0) {
    const relative = (file) => path.relative(process.cwd(), file);
    const solidRuns = [];
    const reactRuns = [];
    /** Reruns both suites' files of `entries` `count` times, one invocation per suite each time. */
    const rerunFiles = (entries, count) => {
      const files = (results) => [
        ...new Set(
          entries
            .map((entry) => results.get(entry.key)?.file)
            .filter(Boolean)
            .map(relative),
        ),
      ];
      const solidFiles = files(solid);
      const reactFiles = files(react);
      for (let attempt = 0; attempt < count; attempt += 1) {
        solidRuns.push(rerun(`test:solid:${browser}`, solidFiles, 'packages/solid/src/'));
        if (reactFiles.length > 0) {
          reactRuns.push(rerun(`test:${browser}`, reactFiles, 'packages/react/src/'));
        }
      }
    };
    rerunFiles(solidOnly, CONFIRM_RUNS);
    let { confirmed, unconfirmed: notConfirmed } = confirm(solidOnly, solidRuns, reactRuns);
    const open = notConfirmed.filter((entry) => entry.inconclusive);
    if (open.length > 0) {
      // All the open failures' files in one batch, not one per test, so the extra time stays
      // bounded: about 22 s per rerun pair on CI, so the 10 more add about 4 minutes. Every rerun
      // so far ran their files, so they are judged on all MAX_CONFIRM_RUNS.
      rerunFiles(open, MAX_CONFIRM_RUNS - CONFIRM_RUNS);
      const second = confirm(open, solidRuns, reactRuns);
      confirmed = [...confirmed, ...second.confirmed];
      notConfirmed = [
        ...notConfirmed.filter((entry) => !entry.inconclusive),
        ...second.unconfirmed,
      ];
    }
    unconfirmed.push(...notConfirmed);
    solidOnly = confirmed;
  }

  const counts = (entry) =>
    entry.runs === undefined
      ? ''
      : ` (Solid failed ${entry.solidFailed}/${entry.runs}, upstream passed ${entry.upstreamPassed}/${entry.runs}, p ${entry.p.toPrecision(2)})`;
  for (const entry of solidOnly.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(
      `- [upstream: ${entry.upstream}] ${entry.key}${counts(entry)}\n    ${entry.message}`,
    );
  }
  for (const entry of unconfirmed) {
    console.log(`- not confirmed${counts(entry)}: ${entry.key}`);
  }
  console.log(
    `\nSolid failures: ${solidFailures}; shared with upstream: ${shared}; Solid-only: ${solidOnly.length}${
      browser ? `; not confirmed: ${unconfirmed.length}` : ''
    }; upstream failures Solid passes: ${upstreamOnly}`,
  );
  return solidOnly.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main());
}
