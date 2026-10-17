// The core phase's profiling pass (plan 3, leaf 4.2): where the Solid library's main-thread time
// goes, per shared-core candidate (`shared/attribution.mjs`), over every browser scenario step and
// every SSR case. Each step and each case runs under the CPU profiler and the sampling heap
// profiler; samples and allocations are mapped through the sourcemaps of unminified production
// builds (the same code paths as the minified bench, with function names the rules read) and
// credited to their deepest candidate or library frame. Collection time is shared out by
// allocated bytes and reported as each bucket's GC share beside its self time.
//
// Usage (from packages/base-ui):
//   node test/perf-solid/attribution.mjs [runs=4] [browser filter,...] [SSR filter,...]
//   filters: `shared/filter.mjs` terms; empty or `all` runs everything
// Env: ATTRIBUTION_SRC=<library src> (default the working tree), ATTRIBUTION_OUT=<build folder
//   name> (default attribution), NO_BUILD=1, BROWSER_ONLY=1,
//   SERVER_ONLY=1, SSR_RENDERS=20, RESULTS_FILE=<path without extension>.
import fs from 'node:fs';
import http from 'node:http';
import { Session } from 'node:inspector/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { chromium } from 'playwright';
import {
  attributeAllocations,
  attributeCpu,
  CANDIDATES,
  distributeGc,
  setLibraryRoot,
} from './shared/attribution.mjs';
import { matchesFilter, parseFilter } from './shared/filter.mjs';
import { evaluateInTask } from './shared/measure.mjs';

/**
 * V8 inlining hides the inlined function's frames from the sampling heap profiler, which then
 * credits an allocation to the caller (the allocation control caught a native context owner's bytes
 * landing in its callers). Both engines run without it; shares, not absolute times, are read.
 */
const NO_INLINING = ['--no-turbo-inlining', '--no-maglev-inlining'];
if (!NO_INLINING.every((flag) => process.execArgv.includes(flag))) {
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, ...NO_INLINING, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  process.exit(child.status ?? 1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUi = path.resolve(here, '../..');
const repo = path.resolve(baseUi, '../..');
const builds = path.join(repo, '.tmp/grunt/bench-builds');
const resultsDir = path.join(repo, '.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 4);
const WARMUP = 2;
const SSR_RENDERS = Number(process.env.SSR_RENDERS ?? 20);
const SRC = process.env.ATTRIBUTION_SRC ?? path.join(baseUi, 'packages/solid/src');
setLibraryRoot(SRC);
const BROWSER_OUT = process.env.ATTRIBUTION_OUT ?? 'attribution';
const SSR_OUT = `ssr-${BROWSER_OUT}`;
/**
 * Sampling: 100 µs CPU interval, a 32 KB mean allocation interval. Heap sampling reports only
 * objects still alive when it stops unless told to keep collected ones; garbage is what drives
 * collection time, so both kinds are kept.
 */
const HEAP_SAMPLING = {
  samplingInterval: 32 * 1024,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
};
const CPU_INTERVAL_US = 100;

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: baseUi,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
}

if (!process.env.NO_BUILD) {
  run('bun', ['x', 'vite', 'build', '-c', 'test/perf-solid/vite.config.mjs'], {
    LIB: 'solid',
    SOLID_SRC: SRC,
    OUT: BROWSER_OUT,
    MINIFY: '0',
    SOURCEMAP: '1',
  });
  run('node', ['test/perf-solid/ssr/run.mjs'], {
    BUILD_ONLY: '1',
    SSR_MINIFY: '0',
    SSR_SOURCEMAP: '1',
    SSR_VARIANTS: `solid:solid:${SRC}:${SSR_OUT}`,
  });
}

// --- Source resolution through the sourcemaps ---
const maps = new Map();
/** The map of a built file (`<file>.map` beside it), or `null`. */
function mapOf(file) {
  if (!maps.has(file)) {
    const mapFile = `${file}.map`;
    maps.set(
      file,
      fs.existsSync(mapFile) ? new TraceMap(fs.readFileSync(mapFile, 'utf8'), mapFile) : null,
    );
  }
  return maps.get(file);
}

/** A built file for a frame URL: the browser build served here, or a file URL on the server. */
let browserUrlPrefix = '';
function fileOf(url) {
  if (browserUrlPrefix && url.startsWith(browserUrlPrefix)) {
    return path.join(
      builds,
      'solid',
      BROWSER_OUT,
      url.slice(browserUrlPrefix.length).split('?')[0],
    );
  }
  if (url.startsWith('file://')) {
    return fileURLToPath(url);
  }
  return null;
}

const resolved = new Map();
/** A CDP call frame's original source and function name. */
function resolve(callFrame) {
  const key = `${callFrame.url}:${callFrame.lineNumber}:${callFrame.columnNumber}:${callFrame.functionName}`;
  if (resolved.has(key)) {
    return resolved.get(key);
  }
  const file = fileOf(callFrame.url);
  const map = file && mapOf(file);
  let source = callFrame.url;
  let line = callFrame.lineNumber + 1;
  if (map) {
    const position = originalPositionFor(map, {
      line: callFrame.lineNumber + 1,
      column: callFrame.columnNumber,
    });
    if (position.source) {
      source = position.source;
      line = position.line ?? line;
    }
  }
  const result = { source, name: callFrame.functionName, line };
  resolved.set(key, result);
  return result;
}

const add = (into, from) => {
  for (const [key, value] of Object.entries(from)) {
    into[key] = (into[key] ?? 0) + value;
  }
};

/** One profiled span's attribution: self ms, allocated bytes and GC share per bucket. */
function attribute(cpu, heap) {
  const time = attributeCpu(cpu, resolve);
  const bytes = attributeAllocations(heap, resolve);
  return {
    ms: time.ms,
    fns: time.fns,
    runtime: time.runtime,
    gcMs: time.gcMs,
    // Busy time: idle and the profiler's own work left out.
    totalMs: time.totalMs - time.idleMs - time.profilerMs,
    bytes,
    gcShare: distributeGc(time.gcMs, bytes),
  };
}

const empty = () => ({
  ms: {},
  fns: {},
  runtime: {},
  gcMs: 0,
  totalMs: 0,
  bytes: {},
  gcShare: {},
});
function merge(into, part) {
  add(into.ms, part.ms);
  for (const [bucket, fns] of Object.entries(part.fns ?? {})) {
    add((into.fns[bucket] ??= {}), fns);
  }
  add(into.runtime, part.runtime);
  add(into.bytes, part.bytes);
  add(into.gcShare, part.gcShare);
  into.gcMs += part.gcMs;
  into.totalMs += part.totalMs;
}

const results = { browser: {}, ssr: {} };

/**
 * `ATTRIBUTION_PROBE=<global>`: a counter the page's code increments (the positive control's
 * injection counts its own calls), recorded per measured step so a control knows exactly what it
 * injected.
 */
const PROBE = process.env.ATTRIBUTION_PROBE;
const readProbe = (page) => page.evaluate((name) => globalThis[name] ?? 0, PROBE);

// --- Browser scenarios ---
if (!process.env.SERVER_ONLY) {
  const root = path.join(builds, 'solid', BROWSER_OUT);
  const server = http
    .createServer((req, res) => {
      const file = path.join(root, req.url.split('?')[0].slice(1) || 'index.html');
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html',
      });
      fs.createReadStream(file).pipe(res);
    })
    .listen(0);
  const { port } = server.address();
  browserUrlPrefix = `http://localhost:${port}/`;
  const browser = await chromium.launch({
    args: [`--js-flags=--expose-gc ${NO_INLINING.join(' ')}`],
  });
  const open = async () => {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: CPU_INTERVAL_US });
    await cdp.send('HeapProfiler.enable');
    await page.goto(browserUrlPrefix);
    await page.waitForFunction(() => 'bench' in window);
    return { page, cdp };
  };
  const probe = await open();
  const all = await probe.page.evaluate(() => window.bench.list());
  const vocab = await probe.page.evaluate(() => window.bench.vocab);
  await probe.page.close();
  const raw = process.argv[3] === 'all' ? '' : process.argv[3];
  const filter = parseFilter(raw, { ids: all.map((s) => s.id), ...vocab });
  for (const scenario of all.filter((s) => matchesFilter(s, filter))) {
    const { page, cdp } = await open();
    const entry = { components: scenario.components, steps: {} };
    for (let cycle = 0; cycle < WARMUP + RUNS; cycle += 1) {
      await page.evaluate('gc()');
      for (let index = 0; index < scenario.steps.length; index += 1) {
        const measured = cycle >= WARMUP;
        const probeBefore = measured && PROBE ? await readProbe(page) : 0;
        if (measured) {
          await cdp.send('HeapProfiler.startSampling', HEAP_SAMPLING);
          await cdp.send('Profiler.start');
        }
        await evaluateInTask(page, ([id, step]) => window.bench.step(id, step), [
          scenario.id,
          index,
        ]);
        if (measured) {
          const { profile: cpu } = await cdp.send('Profiler.stop');
          const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
          entry.steps[scenario.steps[index]] ??= empty();
          const step = entry.steps[scenario.steps[index]];
          merge(step, attribute(cpu, heap));
          if (PROBE) {
            step.probe = (step.probe ?? 0) + (await readProbe(page)) - probeBefore;
          }
        }
      }
    }
    results.browser[scenario.id] = entry;
    await page.close();
    console.log(`browser ${scenario.id}`);
  }
  await browser.close();
  server.close();
}

// --- SSR cases (this process) ---
if (!process.env.BROWSER_ONLY) {
  const entry = path.join(builds, SSR_OUT, 'server', 'entry-server.mjs');
  const serverBundle = await import(pathToFileURL(entry).href);
  const { ssrCases } = await import('./ssr/cases.ts');
  const manifest = await import('./shared/manifest.ts');
  const filter = parseFilter(process.argv[4] === 'all' ? '' : process.argv[4], {
    ids: ssrCases.map((c) => c.id),
    components: manifest.COMPONENTS,
    tags: manifest.SCENARIO_TAGS,
  });
  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: CPU_INTERVAL_US });
  await session.post('HeapProfiler.enable');
  for (const ssrCase of ssrCases) {
    if (!serverBundle.keys.includes(ssrCase.id) || !matchesFilter(ssrCase, filter)) {
      continue;
    }
    for (let i = 0; i < 3; i += 1) {
      serverBundle.render(ssrCase.id);
    }
    await session.post('HeapProfiler.startSampling', HEAP_SAMPLING);
    await session.post('Profiler.start');
    for (let i = 0; i < SSR_RENDERS; i += 1) {
      serverBundle.render(ssrCase.id);
    }
    const { profile: cpu } = await session.post('Profiler.stop');
    const { profile: heap } = await session.post('HeapProfiler.stopSampling');
    results.ssr[ssrCase.id] = { components: ssrCase.components, server: attribute(cpu, heap) };
    console.log(`ssr ${ssrCase.id}`);
  }
  session.disconnect();
}

// --- Report ---
const totals = {
  browser: empty(),
  ssr: empty(),
  byComponent: {},
  byStep: {},
};
for (const [, scenario] of Object.entries(results.browser)) {
  for (const [step, part] of Object.entries(scenario.steps)) {
    merge(totals.browser, part);
    merge((totals.byStep[step] ??= empty()), part);
    merge((totals.byComponent[scenario.components[0]] ??= empty()), part);
  }
}
for (const [, ssrCase] of Object.entries(results.ssr)) {
  merge(totals.ssr, ssrCase.server);
}

const fmt = (n) => (n ?? 0).toFixed(1);
const mb = (n) => ((n ?? 0) / 1048576).toFixed(1);
const buckets = [...CANDIDATES.map((c) => c.id), 'bench-harness', 'runtime'];
const lines = [
  '# Main-thread attribution',
  '',
  "Shares only: the profile runs unminified builds, whose absolute speed differs from the minified bench. An expected gain in ms is a share here times the family's time in the latest minified `bench:component --compare` at main.",
  '',
  'Error bars from the positive controls (`attribution-control.mjs`, Linux Chromium, 2026-10-17): injected CPU work came out at 111–123% of the added time (the bar is ±25%), injected allocations at 101–103% of their bytes (the bar is ±10%). Read CPU shares as accurate to about a quarter.',
  '',
  `Library source ${SRC} · unminified production builds with sourcemaps · browser ${Object.keys(results.browser).length} scenarios × ${RUNS} measured cycles · SSR ${Object.keys(results.ssr).length} cases × ${SSR_RENDERS} renders · CPU every ${CPU_INTERVAL_US} µs, allocations every ${HEAP_SAMPLING.samplingInterval / 1024} KB on average.`,
  '',
  `Browser: ${fmt(totals.browser.totalMs)} ms busy, of which ${fmt(totals.browser.gcMs)} ms collection. SSR: ${fmt(totals.ssr.totalMs)} ms busy, of which ${fmt(totals.ssr.gcMs)} ms collection.`,
  '',
  '## Candidates',
  '',
  'Self ms is CPU time credited to the bucket; GC share is collection time shared out by its allocated bytes. Total = self + GC share.',
  '',
  '| bucket | leaf | browser self ms | browser GC share | browser MB | SSR self ms | SSR GC share | SSR MB | total ms | share of busy |',
  '|---|---|---|---|---|---|---|---|---|---|',
];
const busy = totals.browser.totalMs + totals.ssr.totalMs;
const rows = buckets.map((id) => {
  const total =
    (totals.browser.ms[id] ?? 0) +
    (totals.browser.gcShare[id] ?? 0) +
    (totals.ssr.ms[id] ?? 0) +
    (totals.ssr.gcShare[id] ?? 0);
  return { id, total };
});
for (const { id, total } of rows.sort((a, b) => b.total - a.total)) {
  const leaf = CANDIDATES.find((c) => c.id === id)?.leaf ?? '-';
  lines.push(
    `| ${id} | ${leaf} | ${fmt(totals.browser.ms[id])} | ${fmt(totals.browser.gcShare[id])} | ${mb(totals.browser.bytes[id])} | ${fmt(totals.ssr.ms[id])} | ${fmt(totals.ssr.gcShare[id])} | ${mb(totals.ssr.bytes[id])} | ${fmt(total)} | ${((100 * total) / busy).toFixed(1)}% |`,
  );
}
const files = {};
for (const side of [totals.browser, totals.ssr]) {
  for (const source of [side.ms, side.gcShare]) {
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith('file:')) {
        files[key] = (files[key] ?? 0) + value;
      }
    }
  }
}
lines.push(
  '',
  '## Runtime with no library frame on the stack, by package (self ms)',
  '',
  '| package | browser | SSR |',
  '|---|---|---|',
  ...[...new Set([...Object.keys(totals.browser.runtime), ...Object.keys(totals.ssr.runtime)])]
    .sort(
      (a, b) =>
        (totals.browser.runtime[b] ?? 0) +
        (totals.ssr.runtime[b] ?? 0) -
        (totals.browser.runtime[a] ?? 0) -
        (totals.ssr.runtime[a] ?? 0),
    )
    .map(
      (pkg) => `| ${pkg} | ${fmt(totals.browser.runtime[pkg])} | ${fmt(totals.ssr.runtime[pkg])} |`,
    ),
  '',
  '## Inside the candidates (top functions by self ms, browser + SSR)',
  '',
  ...CANDIDATES.flatMap((candidate) => {
    const fns = {};
    for (const side of [totals.browser, totals.ssr]) {
      add(fns, side.fns[candidate.id] ?? {});
    }
    const top = Object.entries(fns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return top.length
      ? [`- ${candidate.id}: ${top.map(([name, value]) => `${name} ${fmt(value)}`).join(', ')}`]
      : [];
  }),
  '',
  '## Library files outside the candidates (top 20, self + GC share)',
  '',
  '| file | ms |',
  '|---|---|',
  ...Object.entries(files)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, value]) => `| ${key.slice(5)} | ${fmt(value)} |`),
  '',
  '## Browser by step (self + GC share per candidate)',
  '',
  `| step | ${buckets.join(' | ')} |`,
  `|---|${buckets.map(() => '---').join('|')}|`,
  ...Object.entries(totals.byStep)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(
      ([step, part]) =>
        `| ${step} | ${buckets.map((id) => fmt((part.ms[id] ?? 0) + (part.gcShare[id] ?? 0))).join(' | ')} |`,
    ),
  '',
  '## Browser by component (self + GC share per candidate)',
  '',
  `| component | ${buckets.join(' | ')} |`,
  `|---|${buckets.map(() => '---').join('|')}|`,
  ...Object.entries(totals.byComponent)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(
      ([component, part]) =>
        `| ${component} | ${buckets.map((id) => fmt((part.ms[id] ?? 0) + (part.gcShare[id] ?? 0))).join(' | ')} |`,
    ),
  '',
);
const out =
  process.env.RESULTS_FILE ??
  path.join(resultsDir, `attribution-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(`${out}.json`, JSON.stringify({ src: SRC, runs: RUNS, results, totals }, null, 2));
fs.writeFileSync(`${out}.md`, lines.join('\n'));
console.log(`\n${lines.join('\n')}\nwritten ${out}.{md,json}`);
