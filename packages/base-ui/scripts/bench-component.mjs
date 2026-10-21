#!/usr/bin/env bun
// bench:component: one report per component across every perf instrument (plan 3, leaves 1.5–1.7).
//
//   bun run bench:component <name>[,...]|all [--runs 12] [--ssr-runs 20] [--filter <terms>]
//                           [--save-baseline <label> [--at <sha>]] [--compare <label>]
//
// Builds once, then runs the browser scenarios that list a component (`component:<name>` terms,
// plus any `--filter` terms, browser only), the SSR cases that list it, and the cost tests
// `COST_TESTS` assigns it; a component with neither a cost test nor a `PENDING_COST` entry fails.
// `--save-baseline` stores the run under a label and refuses a dirty tree; with `--at <sha>` it
// measures that commit's library instead of the working tree's (built as `--compare` builds a
// baseline, so an old commit gets today's harness) and skips the working tree's cost tests. Only
// correctness failures block a baseline: exit-bar misses are recorded as targets. `--compare` builds the
// labelled commit's library source (extracted with `git archive`, so it is the commit and nothing
// else), caches that build by SHA and harness hash, runs it interleaved with the working tree and
// React in one session, and fails on any regression under the rule (`shared/regression.mjs`, D16). Run with Bun: it imports
// the TypeScript manifests directly.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closest, matchesFilter, parseFilter } from '../test/perf-solid/shared/filter.mjs';
import { splitAllowed } from '../test/perf-solid/shared/allowances.mjs';
import { judgeRun, unmeasuredPairs, variantPairs } from '../test/perf-solid/shared/report.mjs';
import { EXCLUSIVE_LOCK, LOCK_TIMEOUT_SECONDS } from './test-all.mjs';
import { EXIT_BAR, exitBar, FDR_Q, GATED, median } from '../test/perf-solid/shared/regression.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUi = path.resolve(here, '..');
const repo = path.resolve(baseUi, '../..');
const perf = path.join(baseUi, 'test/perf-solid');
const builds = path.join(repo, '.tmp/grunt/bench-builds');
const resultsDir = path.join(repo, '.tmp/grunt/bench-results');
const USAGE =
  'bench:component <name>[,...]|all [--runs N] [--ssr-runs N] [--filter terms] [--save-baseline label [--at sha] | --compare label]';

/** @param {string[]} argv */
/**
 * Browser runs per variant: twice this many samples a side (24), over the balanced order's rounds
 * (D22), the fewest at which the rule
 * (D16) flags five true 2x regressions among 400 judged pairs under the Mac's GC noise.
 */
export const DEFAULT_RUNS = 12;

export function parseArgs(argv) {
  const options = {
    names: [],
    runs: DEFAULT_RUNS,
    ssrRuns: 20,
    filter: null,
    saveBaseline: null,
    at: null,
    compare: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[(i += 1)];
      if (next === undefined) throw new Error(`${arg} needs a value; usage: ${USAGE}`);
      return next;
    };
    if (arg === '--runs') options.runs = Number(value());
    else if (arg === '--ssr-runs') options.ssrRuns = Number(value());
    else if (arg === '--filter') options.filter = value();
    else if (arg === '--save-baseline') options.saveBaseline = value();
    else if (arg === '--compare') options.compare = value();
    else if (arg === '--at') options.at = value();
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}; usage: ${USAGE}`);
    else options.names.push(...arg.split(',').filter(Boolean));
  }
  if (options.names.length === 0) throw new Error(`usage: ${USAGE}`);
  if (options.saveBaseline && options.compare) {
    throw new Error('--save-baseline and --compare are separate runs; pass one');
  }
  if (options.at && !options.saveBaseline) {
    throw new Error('--at names the commit a baseline measures; pass it with --save-baseline');
  }
  return options;
}

/**
 * The failures that keep a run from becoming a baseline: all but exit-bar misses, which a baseline
 * records as targets (its `exitBar`).
 * @param {string[]} failures
 */
export const baselineBlockers = (failures) =>
  failures.filter((failure) => !failure.startsWith('exit bar: '));

/** @param {string[]} names @param {readonly string[]} known */
export function resolveComponents(names, known) {
  if (names.includes('all')) return [...known];
  for (const name of names) {
    if (!known.includes(name)) {
      throw new Error(`Unknown component "${name}"; did you mean "${closest(name, known)}"?`);
    }
  }
  return [...new Set(names)];
}

/**
 * The cost tests to run for `components`, each once, plus the pending ones and any component with
 * neither (an error the caller reports).
 */
export function costPlan(components, costTests, pending) {
  const names = [];
  const pendingOut = {};
  const missing = [];
  for (const component of components) {
    if (costTests[component]) {
      for (const name of costTests[component]) if (!names.includes(name)) names.push(name);
    } else if (pending[component]) {
      pendingOut[component] = pending[component];
    } else {
      missing.push(component);
    }
  }
  return { names, pending: pendingOut, missing };
}

/** vitest's `-t` matches the space-joined full name; `vitest list` prints `describe > it`. */
export const vitestName = (name) => name.split(' > ').join(' ');

/** An anchored `-t` pattern for exactly these full names. */
export function costPattern(names) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^(?:${names.map((name) => escape(vitestName(name))).join('|')})$`;
}

/**
 * The environment for git commands aimed at the repo in `cwd`: without git's own variables
 * (`GIT_DIR`, `GIT_INDEX_FILE` and the rest), which a process started under a git hook inherits
 * and which would aim the command at another repo.
 */
const repoEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

function git(cwd, args, encoding = 'utf8') {
  const result = spawnSync('git', args, { cwd, encoding, env: repoEnv(), maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

const sha256 = () => createHash('sha256');

/**
 * The commit a run measured and whether the tree matched it. A dirty tree also gets a hash of
 * `git diff HEAD` plus every untracked file's path and content, so two dirty runs can be told apart.
 */
export function gitProvenance(cwd) {
  const sha = git(cwd, ['rev-parse', 'HEAD']).trim();
  const dirty = git(cwd, ['status', '--porcelain', '--untracked-files=all']).trim() !== '';
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .sort();
  if (!dirty) return { sha, dirty, diffSha256: null, untracked };
  const hash = sha256().update(git(cwd, ['diff', 'HEAD', '--binary'], 'buffer'));
  for (const file of untracked)
    hash.update(`\0${file}\0`).update(fs.readFileSync(path.join(cwd, file)));
  return { sha, dirty, diffSha256: hash.digest('hex'), untracked };
}

/**
 * True when the working tree's bun.lock differs from the baseline commit's: `--compare` builds the
 * baseline's library source against today's node_modules, so a dependency change between the two
 * would otherwise read as no difference.
 */
export function depsDrift(cwd, baseSha) {
  const diff = spawnSync('git', ['diff', '--quiet', baseSha, '--', 'bun.lock'], {
    cwd,
    env: repoEnv(),
  });
  if (diff.status !== 0 && diff.status !== 1)
    throw new Error(`git diff ${baseSha} -- bun.lock failed`);
  return diff.status === 1;
}

/** Hash of the tracked and untracked (not ignored) files under `paths`, by path and content. */
export function treeHash(cwd, paths) {
  const files = git(cwd, ['ls-files', '-co', '--exclude-standard', '--', ...paths])
    .split('\n')
    .filter(Boolean)
    .sort();
  const hash = sha256();
  for (const file of files) {
    const abs = path.join(cwd, file);
    if (fs.existsSync(abs)) hash.update(`${file}\0`).update(fs.readFileSync(abs)).update('\0');
  }
  return hash.digest('hex');
}

/** Hash of every file under `dir`, by relative path and content. */
export function dirHash(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else files.push(path.relative(dir, abs));
    }
  };
  walk(dir);
  const hash = sha256();
  for (const file of files.sort()) {
    hash
      .update(`${file}\0`)
      .update(fs.readFileSync(path.join(dir, file)))
      .update('\0');
  }
  return hash.digest('hex');
}

/** True when `dir` holds a build whose recorded hash still matches its files. */
function cachedBuild(dir) {
  const record = `${dir}.build-hash`;
  return (
    fs.existsSync(dir) && fs.existsSync(record) && fs.readFileSync(record, 'utf8') === dirHash(dir)
  );
}

/**
 * `command args` under the machine lock with a timeout: browser and SSR runs launch Chromium, like
 * the exclusive gate suites, and a hung one must not hold the lock.
 */
export function lockedCommand(command, args, { lock, timeoutSeconds }) {
  return ['flock', [lock, 'timeout', '-k', '30', String(timeoutSeconds), command, ...args]];
}

/**
 * A locked run's timeout: `units` of work at `secondsPerUnit` each, never below the gate timeout.
 * The timeout only stops a hung run from holding the lock, so it must outlast an honest one: every
 * family at 12 runs takes over an hour on the Mac, and the gate timeout alone cut it off.
 */
export function benchTimeoutSeconds(units, secondsPerUnit) {
  return Math.max(LOCK_TIMEOUT_SECONDS, units * secondsPerUnit);
}

function run(
  command,
  args,
  { env = {}, cwd = baseUi, allowFail = false, locked = false, timeoutSeconds } = {},
) {
  if (locked) {
    fs.mkdirSync(path.dirname(EXCLUSIVE_LOCK), { recursive: true });
    [command, args] = lockedCommand(command, args, {
      lock: EXCLUSIVE_LOCK,
      timeoutSeconds: timeoutSeconds ?? LOCK_TIMEOUT_SECONDS,
    });
  }
  console.log(
    `\n$ ${Object.entries(env)
      .map(([k, v]) => `${k}=${v} `)
      .join('')}${command} ${args.join(' ')}`,
  );
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
  return result.status ?? 1;
}

/**
 * Builds the library of commit `sha`, extracted with `git archive` (the commit and nothing else),
 * for the browser bench and the SSR bench, cached by SHA and harness hash. `name` is the SSR
 * variant's name; `others` are the other SSR variants built alongside.
 */
function buildArchived(sha, name, others) {
  const harness = treeHash(repo, [path.relative(repo, perf), 'bun.lock']);
  const key = `${sha.slice(0, 12)}-${harness.slice(0, 12)}`;
  const browserOut = `${name}-${key}`;
  const browserDir = path.join(builds, 'solid', browserOut);
  const ssrOut = `ssr-${name}-${key}`;
  const ssrDir = path.join(builds, ssrOut);
  const src = path.join(repo, '.tmp/grunt/bench-src', sha);
  const needBrowser = !cachedBuild(browserDir);
  const needSsr = !cachedBuild(ssrDir);
  if (needBrowser || needSsr) {
    fs.rmSync(src, { recursive: true, force: true });
    fs.mkdirSync(src, { recursive: true });
    const archive = spawnSync('git', ['archive', sha, 'packages/base-ui/packages/solid/src'], {
      cwd: repo,
      env: repoEnv(),
      maxBuffer: 1 << 30,
    });
    if (archive.status !== 0) throw new Error(`git archive ${sha}: ${archive.stderr}`);
    const untar = spawnSync('tar', ['-x', '-C', src], { input: archive.stdout });
    if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  }
  const srcRoot = path.join(src, 'packages/base-ui/packages/solid/src');
  const ssrVariant = `${name}:solid:${srcRoot}:${ssrOut}`;
  try {
    if (needBrowser) {
      run('bun', ['x', 'vite', 'build', '-c', 'test/perf-solid/vite.config.mjs'], {
        env: { LIB: 'solid', SOLID_SRC: srcRoot, OUT: browserOut },
      });
      fs.writeFileSync(`${browserDir}.build-hash`, dirHash(browserDir));
    }
    run('node', ['test/perf-solid/ssr/run.mjs'], {
      env: {
        BUILD_ONLY: '1',
        SSR_VARIANTS: ['react:react', ...others, ssrVariant].join(','),
        ...(needSsr ? {} : { NO_BUILD: name }),
      },
    });
    if (needSsr) fs.writeFileSync(`${ssrDir}.build-hash`, dirHash(ssrDir));
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
  }
  return {
    browserOut,
    ssrVariant,
    cached: !needBrowser && !needSsr,
    buildHash: { browser: dirHash(browserDir), ssr: dirHash(ssrDir) },
  };
}

/**
 * The driver. `deps` replaces the process runner, the archived-library build, the results folder
 * and the builds folder (the end-to-end test feeds canned runner output through them). Resolves to the exit code.
 * @param {string[]} argv
 * @param {{ run?: typeof run, buildArchived?: typeof buildArchived, resultsDir?: string, buildsDir?: string }} [deps]
 */
export async function main(argv, deps = {}) {
  const exec = deps.run ?? run;
  const archived = deps.buildArchived ?? buildArchived;
  const outDir = deps.resultsDir ?? resultsDir;
  const buildsDir = deps.buildsDir ?? builds;
  const options = parseArgs(argv);
  const manifest = await import('../test/perf-solid/shared/manifest.ts');
  const { ssrCases } = await import('../test/perf-solid/ssr/cases.ts');
  const components = resolveComponents(options.names, manifest.COMPONENTS);
  const cur = gitProvenance(repo);
  if (options.saveBaseline && cur.dirty) {
    throw new Error('--save-baseline needs a clean tree: a baseline is a commit. Commit first.');
  }
  const plan = costPlan(components, manifest.COST_TESTS, manifest.PENDING_COST);
  if (plan.missing.length) {
    throw new Error(
      `No cost test or PENDING_COST entry for ${plan.missing.join(', ')} (shared/manifest.ts)`,
    );
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const label = components.length > 3 ? `${components.length}-components` : components.join('+');
  const out = path.join(outDir, `component-${label}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  // --- Builds (once) ---
  exec('bun', ['run', 'bench:solid:build']);
  let base = null;
  /** With `--at`, the commit measured instead of the working tree. */
  let measured = null;
  const browserVariants = ['react:react:dist'];
  const ssrVariants = ['react:react'];
  if (options.compare) {
    const file = path.join(outDir, 'baselines', `${options.compare}.json`);
    if (!fs.existsSync(file)) throw new Error(`No baseline "${options.compare}" at ${file}`);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const built = archived(saved.sha, 'base', ['cur:solid']);
    base = {
      label: options.compare,
      sha: saved.sha,
      dirty: false,
      cachedBuild: built.cached,
      depsFromWorkingTree: depsDrift(repo, saved.sha),
      buildHash: built.buildHash,
    };
    browserVariants.push(`base:solid:${built.browserOut}`, 'cur:solid:dist');
    ssrVariants.push(built.ssrVariant, 'cur:solid');
  } else if (options.at) {
    const sha = git(repo, ['rev-parse', options.at]).trim();
    const built = archived(sha, 'at', []);
    measured = { sha, buildHash: built.buildHash };
    browserVariants.push(`solid:solid:${built.browserOut}`);
    ssrVariants.push(built.ssrVariant.replace(/^at:/, 'solid:'));
  } else {
    browserVariants.push('solid:solid:dist');
    ssrVariants.push('solid:solid');
    exec('node', ['test/perf-solid/ssr/run.mjs'], {
      env: { BUILD_ONLY: '1', SSR_VARIANTS: ssrVariants.join(',') },
    });
  }
  const curBuildHash = measured?.buildHash ?? {
    browser: dirHash(path.join(buildsDir, 'solid', 'dist')),
  };

  // --- Browser scenarios ---
  const browserFilter = [...components.map((c) => `component:${c}`), options.filter]
    .filter(Boolean)
    .join(',');
  const browserExit = exec(
    'node',
    ['test/perf-solid/run.mjs', String(options.runs), browserFilter],
    {
      env: { VARIANTS: browserVariants.join(','), RESULTS_FILE: `${out}-browser` },
      allowFail: true,
      locked: true,
      // 50 s a family and run: select and combobox at 12 runs took 9.5 minutes on the Mac.
      timeoutSeconds: benchTimeoutSeconds(components.length * options.runs, 50),
    },
  );
  const browser = fs.existsSync(`${out}-browser.json`)
    ? JSON.parse(fs.readFileSync(`${out}-browser.json`, 'utf8'))
    : null;

  // --- SSR cases ---
  const ssrTerms = parseFilter(components.map((c) => `component:${c}`).join(','), {
    ids: ssrCases.map((c) => c.id),
    components: manifest.COMPONENTS,
    tags: manifest.SCENARIO_TAGS,
  });
  const ssrIds = ssrCases.filter((c) => matchesFilter(c, ssrTerms)).map((c) => c.id);
  let ssr = null;
  let ssrSwapped = null;
  let ssrExit = 0;
  const runSsr = (variants, file) => {
    const code = exec(
      'node',
      // `--expose-gc`: the server sampler collects before each batch (`ssr/sample.mjs`).
      ['--expose-gc', 'test/perf-solid/ssr/run.mjs', String(options.ssrRuns), ssrIds.join(',')],
      {
        env: { NO_BUILD: '1', SSR_VARIANTS: variants.join(','), RESULTS_FILE: file },
        allowFail: true,
        locked: true,
        timeoutSeconds: benchTimeoutSeconds(ssrIds.length * options.ssrRuns, 10),
      },
    );
    return {
      code,
      results: fs.existsSync(`${file}.json`)
        ? JSON.parse(fs.readFileSync(`${file}.json`, 'utf8'))
        : null,
    };
  };
  if (ssrIds.length) {
    const forward = runSsr(ssrVariants, `${out}-ssr`);
    ssrExit = forward.code;
    ssr = forward.results;
    // A comparison also runs in a second process with the variant order reversed: one Node process
    // keeps an offset between its bundles that follows their load order (D22), so a verdict needs
    // both orders to agree.
    if (base) {
      const swapped = runSsr([...ssrVariants].reverse(), `${out}-ssr-swapped`);
      ssrExit ||= swapped.code;
      ssrSwapped = swapped.results;
    }
  }

  // --- Cost tests (working tree; budgets are absolute) ---
  const cost = {
    tests: [],
    pending: plan.pending,
    problems: [],
    ...(options.at ? { skipped: `measures ${options.at}, not the working tree` } : {}),
  };
  if (plan.names.length && !options.at) {
    const report = `${out}-cost.json`;
    exec(
      'bun',
      [
        'x',
        'vitest',
        'run',
        '--project',
        '@solidports/base-ui',
        '.cost.test.tsx',
        '-t',
        costPattern(plan.names),
        '--reporter=json',
        `--outputFile=${report}`,
      ],
      { env: { TZ: 'UTC', VITEST_ENV: 'jsdom' }, allowFail: true },
    );
    const ran = new Map();
    if (fs.existsSync(report)) {
      for (const file of JSON.parse(fs.readFileSync(report, 'utf8')).testResults) {
        for (const assertion of file.assertionResults) {
          if (assertion.status !== 'skipped' && assertion.status !== 'pending') {
            ran.set(assertion.fullName, assertion.status);
          }
        }
      }
    }
    for (const name of plan.names) {
      const status = ran.get(vitestName(name)) ?? 'did not run';
      cost.tests.push({ name, status });
      if (status !== 'passed') cost.problems.push(`${name}: ${status}`);
    }
  }

  // --- Verdicts (D16) ---
  // Every comparison of the run is judged together: Benjamini–Hochberg across browser and SSR.
  const regressions = [];
  const pairs = [];
  if (base && browser) {
    pairs.push(...variantPairs(browser.summary, 'base', 'cur', { raw: browser.raw }));
  }
  const browserPairCount = pairs.length;
  const ssrUnmeasured = [];
  if (base && ssr) {
    for (const [key, row] of Object.entries(ssr.results)) {
      const swappedRow = ssrSwapped?.results[key];
      for (const metric of ['serverMs', 'hydrateSyncMs']) {
        const a = row.base?.samples[metric] ?? [];
        const b = row.cur?.samples[metric] ?? [];
        const sa = swappedRow?.base?.samples[metric] ?? [];
        const sb = swappedRow?.cur?.samples[metric] ?? [];
        if (a.length && b.length && sa.length && sb.length) {
          pairs.push({ key, metric, orders: [{ base: a, cur: b }, { base: sa, cur: sb }], rule: GATED[metric] });
        } else if (a.length || b.length || sa.length || sb.length) {
          ssrUnmeasured.push(`${key} ${metric}: not measured by both sides in both orders`);
        }
      }
    }
  }
  const judged = judgeRun(pairs);
  // What neither side's verdict covers: steps this engine skipped, and metrics one side measured.
  const notMeasured = [
    ...Object.entries(browser?.notMeasured ?? {}).map(([key, reason]) => `${key}: ${reason}`),
    ...(base && browser ? unmeasuredPairs(browser.summary, 'base', 'cur') : []),
  ];
  const verdicts = {
    browser: judged.verdicts.slice(0, browserPairCount),
    ssr: judged.verdicts.slice(browserPairCount),
  };
  for (const verdict of judged.verdicts) {
    if (verdict.verdict === 'regressed') regressions.push(verdict);
  }
  // Reviewed allowances (`shared/allowances.mjs`): reported, not failed, within their bound.
  // An allowance holds only below React's median for the same row and metric in this session.
  const { allowed, failing } = splitAllowed(regressions, (verdict) => {
    const samples = browser?.summary[verdict.key]?.react?.samples[verdict.metric];
    return samples?.length ? median(samples) : undefined;
  });
  // Plan 3's exit bar on production builds: every SSR case with a floor twin.
  const bar = ssr ? exitBar(ssr.results, base ? 'cur' : 'solid') : [];

  // --- Report ---
  const failures = [
    ...(browserExit
      ? [`browser bench exited ${browserExit}${browser ? '' : ' without results'}`]
      : []),
    ...(ssrExit ? [`SSR bench exited ${ssrExit}${ssr ? '' : ' without results'}`] : []),
    ...(browser?.problems ?? []).map((p) => `browser: ${p}`),
    ...(ssr?.problems ?? []).map((p) => `ssr: ${p}`),
    ...cost.problems.map((p) => `cost: ${p}`),
    ...bar
      .filter((v) => !v.pass)
      .map(
        (v) =>
          `exit bar: ${v.key} ${v.metric} ${v.port.toFixed(2)} ms is ${v.portVsFloor.toFixed(2)}x the floor and ${v.portVsReact.toFixed(2)}x React (floor ${v.floorVsReact.toFixed(2)}x React); the bar is ${EXIT_BAR}x the floor and below React`,
      ),
    ...failing.map(
      (r) =>
        `regressed: ${r.key} ${r.metric} ${r.base.toFixed(2)} → ${r.cur.toFixed(2)} (95% CI of the shift ${r.ci[0].toFixed(2)} to ${r.ci[1].toFixed(2)}, minimum effect ${r.minEffect.toFixed(2)}, p ${r.p.toExponential(1)})`,
    ),
  ];
  const result = {
    components,
    runs: options.runs,
    ssrRuns: options.ssrRuns,
    filter: options.filter,
    cur: { ...cur, buildHash: curBuildHash },
    base,
    browser: browser && { variants: browser.variants, file: `${out}-browser.json` },
    ssr: ssr
      ? { variants: ssr.variants, cases: ssrIds, file: `${out}-ssr.json` }
      : { skipped: 'no SSR case lists these components' },
    cost,
    verdicts,
    exitBar: bar,
    failures,
  };
  fs.writeFileSync(`${out}.json`, JSON.stringify(result, null, 2));
  const fmt = (n) => (n == null ? '-' : n.toFixed(2));
  const md = [
    `# bench:component ${components.join(', ')}`,
    '',
    `cur ${cur.sha.slice(0, 12)}${cur.dirty ? ` · working tree dirty (diff ${cur.diffSha256.slice(0, 12)}, ${cur.untracked.length} untracked)` : ' · clean'}${base ? ` · base ${base.label} ${base.sha.slice(0, 12)}${base.cachedBuild ? ' (cached build)' : ''}${base.depsFromWorkingTree ? ' · baseline built with working-tree dependencies (bun.lock differs)' : ''}` : ''}`,
    '',
    '## Browser',
    '',
    browser
      ? fs.readFileSync(`${out}-browser.md`, 'utf8').split('\n').slice(2).join('\n')
      : 'no results',
    '',
    '## SSR',
    '',
    ssr
      ? fs.readFileSync(`${out}-ssr.md`, 'utf8').split('\n').slice(2).join('\n')
      : (result.ssr.skipped ?? 'no results'),
    '',
    '## Cost tests (working tree)',
    '',
    ...cost.tests.map((t) => `- ${t.status}: ${t.name}`),
    ...Object.entries(cost.pending).map(([c, leaf]) => `- pending: ${c} (${leaf})`),
  ];
  if (bar.length) {
    md.push(
      '',
      `## Exit bar (port ≤ ${EXIT_BAR}x floor and < React)`,
      '',
      '| key | metric | port ms | port vs React | floor vs React | port vs floor | pass |',
      '|---|---|---|---|---|---|---|',
    );
    for (const v of bar) {
      md.push(
        `| ${v.key} | ${v.metric} | ${fmt(v.port)} | ${fmt(v.portVsReact)}x | ${fmt(v.floorVsReact)}x | ${fmt(v.portVsFloor)}x | ${v.pass ? 'yes' : 'no'} |`,
      );
    }
  }
  if (base) {
    md.push(
      '',
      '## cur vs base (Mann–Whitney, D16)',
      '',
      `${judged.pairs} pairs judged together; Benjamini–Hochberg at q = ${FDR_Q} sets the two-sided p threshold to ${judged.threshold ? judged.threshold.toExponential(2) : 'none (no pair passes)'}, then the 95% CI of the median shift must clear the minimum effect. SSR rows run in two processes with the variant order reversed (D22): their delta, medians and CI are the two orders' means, each order's delta follows in brackets, and a row is regressed or improved only when both orders clear the margin the same way.`,
      '',
      '| key | metric | base | cur | delta | 95% CI | min effect | p | verdict |',
      '|---|---|---|---|---|---|---|---|---|',
    );
    for (const v of [...verdicts.browser, ...verdicts.ssr]) {
      md.push(
        `| ${v.key} | ${v.metric} | ${fmt(v.base)} | ${fmt(v.cur)} | ${fmt(v.delta)}${v.orders ? ` (forward ${fmt(v.orders[0].delta)}, reversed ${fmt(v.orders[1].delta)})` : ''} | ${fmt(v.ci[0])} to ${fmt(v.ci[1])} | ${fmt(v.minEffect)} | ${v.p.toExponential(1)} | ${v.verdict} |`,
      );
    }
  }
  if (allowed.length) {
    md.push(
      '',
      '## Allowed regressions (reviewed, `shared/allowances.mjs`)',
      '',
      ...allowed.map(
        (r) =>
          `- ${r.key} ${r.metric}: ${r.base.toFixed(2)} → ${r.cur.toFixed(2)} (shift ${r.delta.toFixed(2)}, allowed up to ${r.allowance.maxDelta}; React ${r.react.toFixed(2)}; ${r.allowance.decision}, until ${r.allowance.until}: ${r.allowance.reason})`,
      ),
    );
  }
  const unmeasured = [...notMeasured, ...ssrUnmeasured];
  if (unmeasured.length) {
    md.push('', '## Not measured (no verdict)', '', ...unmeasured.map((line) => `- ${line}`));
  }
  if (failures.length) md.push('', '## Failures', '', ...failures.map((f) => `- ${f}`));
  fs.writeFileSync(`${out}.md`, md.join('\n'));
  console.log(`\n${md.join('\n')}\n\nwritten ${out}.{md,json}`);

  if (options.saveBaseline) {
    const blockers = baselineBlockers(failures);
    if (blockers.length) {
      throw new Error(`Not saving a baseline from a run with failures: ${blockers.join('; ')}`);
    }
    const dir = path.join(outDir, 'baselines');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${options.saveBaseline}.json`);
    const browserResults = browser && JSON.parse(fs.readFileSync(`${out}-browser.json`, 'utf8'));
    const ssrResults = ssr && JSON.parse(fs.readFileSync(`${out}-ssr.json`, 'utf8'));
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          label: options.saveBaseline,
          sha: measured?.sha ?? cur.sha,
          buildHash: curBuildHash,
          result,
          browser: browserResults,
          ssr: ssrResults,
        },
        null,
        2,
      ),
    );
    console.log(`saved baseline ${options.saveBaseline} → ${file}`);
    return 0;
  }
  return failures.length ? 1 : 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
