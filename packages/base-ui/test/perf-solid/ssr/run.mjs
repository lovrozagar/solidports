// Server render + hydration benchmark, React (@base-ui/react) vs Solid (@solidports/base-ui), on
// identical fixtures (cases in `cases.ts`, registered by `<lib>/fixtures/<component>.tsx`).
// Production builds: a server bundle per variant (`vite build --ssr`, framework packages external
// so Node resolves their server builds) and a hydratable client bundle per variant.
//
// Usage (from packages/base-ui): node test/perf-solid/ssr/run.mjs [runs=20] [filter,...]
//   filter: as `../run.mjs`, terms from `../shared/filter.mjs` (id prefix, component:, tag:, !)
// Env:
//   SSR_VARIANTS=name:lib[:solidSrc[:outDir]],...  default react:react,solid:solid; a Solid variant
//     may build from another copy of the library source (a baseline) into its own build folder
//     (default ssr-<name>). Ratios are taken against the first.
//   NO_BUILD=1 reuses every build; NO_BUILD=a,b reuses those variants' builds only.
//   BUILD_ONLY=1 builds and exits. SERVER_ONLY=1 skips the browser (hydration) part.
//   SSR_MINIFY=0 keeps the bundles readable (function names for profile.mjs).
//   RESULTS_FILE=<path without extension>.
// Hydrate ms runs from the hydrate call to the commit: React's root layout effect (`hydrateRoot` is
// concurrent, so its sync time is only scheduling), Solid's `hydrate` plus `flush`.
// Server renders and hydration pages alternate between variants run by run. Exit 1 when hydration
// logs a mismatch or a variant's hydrated DOM summary differs from the first variant's.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import solid from '@solidjs/vite-plugin';
import { build } from 'vite';
import { matchesFilter, parseFilter } from '../shared/filter.mjs';
import { median } from '../shared/regression.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packages = path.resolve(here, '../../../packages');
const repo = path.resolve(here, '../../../../..');
const builds = path.join(repo, '.tmp/grunt/bench-builds');
const resultsDir = path.join(repo, '.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 20);
const WARMUP = 3;

const VARIANTS = Object.fromEntries(
  (process.env.SSR_VARIANTS ?? 'react:react,solid:solid').split(',').map((entry) => {
    const [name, lib, src, out] = entry.split(':');
    if (lib !== 'react' && lib !== 'solid') {
      throw new Error(`SSR variant ${entry}: lib must be react or solid`);
    }
    return [name, { lib, src: src || path.join(packages, 'solid/src'), out: out || `ssr-${name}` }];
  }),
);
const NAMES = Object.keys(VARIANTS);
const outDir = (name) => path.join(builds, VARIANTS[name].out);

function config(name, ssr) {
  const { lib, src } = VARIANTS[name];
  return {
    configFile: false,
    root: path.join(here, lib),
    mode: 'production',
    base: './',
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [lib === 'react' ? react() : solid({ ssr: true })],
    resolve: {
      alias: {
        '@base-ui/react': path.join(packages, 'react/src'),
        '@base-ui/utils': path.join(packages, 'utils/src'),
        '@solidports/base-ui': src,
      },
      // One reactive core even when a variant builds from a baseline copy of the source.
      dedupe: ['react', 'react-dom', 'solid-js', '@solidjs/web', '@solidjs/signals'],
    },
    // Framework and utility packages stay external on the server, so Node resolves their
    // production server builds; the libraries' source is bundled.
    ssr: ssr ? { noExternal: [/@base-ui|@solidports/] } : undefined,
    build: ssr
      ? {
          ssr: path.join(here, lib, 'entry-server.tsx'),
          outDir: path.join(outDir(name), 'server'),
          emptyOutDir: true,
          minify: process.env.SSR_MINIFY !== '0',
        }
      : {
          outDir: path.join(outDir(name), 'client'),
          emptyOutDir: true,
          minify: process.env.SSR_MINIFY !== '0',
          chunkSizeWarningLimit: 99999,
        },
  };
}

const reuse = process.env.NO_BUILD === '1' ? NAMES : (process.env.NO_BUILD ?? '').split(',');
for (const name of NAMES) {
  if (reuse.includes(name)) continue;
  await build(config(name, true));
  await build(config(name, false));
}
if (process.env.BUILD_ONLY) process.exit(0);

// --- Server render (Node) ---
const server = {};
for (const name of NAMES) {
  const entry = path.join(outDir(name), 'server', 'entry-server.mjs');
  server[name] = await import(pathToFileURL(entry).href);
}
const first = server[NAMES[0]];
// Every case is registered by every variant, and nothing else is: a drift fails the run.
const caseIds = first.cases.map((c) => c.id).sort();
for (const name of NAMES) {
  const registered = [...server[name].keys].sort();
  if (JSON.stringify(registered) !== JSON.stringify(caseIds)) {
    console.error(`${name} registers ${registered.join(', ')}; cases are ${caseIds.join(', ')}`);
    process.exit(1);
  }
}
let FILTER;
try {
  FILTER = parseFilter(process.argv[3], { ids: caseIds, ...first.vocab });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const keys = first.cases.filter((c) => matchesFilter(c, FILTER)).map((c) => c.id);
if (keys.length === 0) {
  console.error(`No SSR case matches "${process.argv[3]}"; cases: ${caseIds.join(', ')}`);
  process.exit(1);
}
const results = {};
const html = {};
for (const key of keys) {
  results[key] = {};
  for (const name of NAMES) {
    results[key][name] = {
      samples: { serverMs: [], hydrateSyncMs: [], hydrateCommitMs: [], hydrateScriptMs: [] },
    };
  }
  for (let run = 0; run < WARMUP + RUNS; run += 1) {
    for (const name of NAMES) {
      const start = performance.now();
      const markup = server[name].render(key);
      const elapsed = performance.now() - start;
      if (run >= WARMUP) results[key][name].samples.serverMs.push(elapsed);
      (html[name] ??= {})[key] = markup;
    }
  }
  for (const name of NAMES) {
    const entry = results[key][name];
    entry.serverMs = median(entry.samples.serverMs);
    entry.htmlBytes = Buffer.byteLength(html[name][key]);
  }
}

// --- Hydration (Chromium) ---
const problems = [];
if (!process.env.SERVER_ONLY) {
  const { chromium } = await import('playwright');
  const templates = Object.fromEntries(
    NAMES.map((name) => [
      name,
      fs.readFileSync(path.join(outDir(name), 'client', 'index.html'), 'utf8'),
    ]),
  );
  const httpServer = http
    .createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const [name, ...rest] = url.pathname.slice(1).split('/');
      if (!NAMES.includes(name)) {
        res.writeHead(404).end();
        return;
      }
      if (rest.join('/') === '' || rest.join('/') === 'index.html') {
        const key = url.searchParams.get('fixture');
        const page = templates[name]
          .replace('<!--ssr-head-->', server[name].head())
          .replace('<!--ssr-outlet-->', html[name][key]);
        res.writeHead(200, { 'content-type': 'text/html' }).end(page);
        return;
      }
      const file = path.join(outDir(name), 'client', rest.join('/'));
      if (!fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/css' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(0);
  const port = httpServer.address().port;
  const browser = await chromium.launch();
  const settle = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))),
    );
  for (const key of keys) {
    const summaries = {};
    const total = Object.fromEntries(NAMES.map((name) => [name, []]));
    for (let run = 0; run < WARMUP + RUNS; run += 1) {
      for (const name of NAMES) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (message) => {
          const text = message.text();
          if (/hydrat|mismatch|unclaimed/i.test(text)) logs.push(text.slice(0, 200));
        });
        page.on('pageerror', (error) => logs.push(`pageerror: ${String(error).slice(0, 200)}`));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await page.goto(`http://localhost:${port}/${name}/?fixture=${encodeURIComponent(key)}`);
        await page.waitForFunction(() => '__hydrate' in window);
        const before = await cdp.send('Performance.getMetrics');
        const result = await page.evaluate(
          async ([fixture, settleSource]) => {
            const settleFn = new Function(`return (${settleSource})()`);
            const start = performance.now();
            const { syncMs, committed } = window.__hydrate(fixture);
            const commitMs = await committed;
            await settleFn();
            return { syncMs, commitMs, totalMs: performance.now() - start };
          },
          [key, settle.toString()],
        );
        const after = await cdp.send('Performance.getMetrics');
        const metric = (list, metricName) =>
          list.metrics.find((m) => m.name === metricName)?.value ?? 0;
        if (run >= WARMUP) {
          const samples = results[key][name].samples;
          samples.hydrateSyncMs.push(result.syncMs);
          samples.hydrateCommitMs.push(result.commitMs);
          samples.hydrateScriptMs.push(
            (metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) * 1000,
          );
          total[name].push(result.totalMs);
        }
        if (run === WARMUP) {
          summaries[name] = await page.evaluate(() => ({
            nodes: document.body.querySelectorAll('*').length,
            expanded: document.querySelectorAll('[aria-expanded="true"]').length,
            checkboxes: document.querySelectorAll('[role="checkbox"]').length,
            dialog: document.querySelectorAll('[role="dialog"]').length,
            tabsSelected: document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
            labelled: document.querySelectorAll('[aria-labelledby]').length,
          }));
          for (const log of new Set(logs)) problems.push(`${key} [${name}] ${log}`);
        }
        await page.close();
      }
    }
    for (const name of NAMES) {
      const entry = results[key][name];
      entry.hydrateSyncMs = median(entry.samples.hydrateSyncMs);
      entry.hydrateCommitMs = median(entry.samples.hydrateCommitMs);
      entry.hydrateTotalMs = median(total[name]);
      entry.hydrateScriptMs = median(entry.samples.hydrateScriptMs);
    }
    for (const name of NAMES.slice(1)) {
      if (JSON.stringify(summaries[NAMES[0]]) !== JSON.stringify(summaries[name])) {
        problems.push(
          `${key}: hydrated DOM differs: ${NAMES[0]} ${JSON.stringify(summaries[NAMES[0]])} ≠ ${name} ${JSON.stringify(summaries[name])}`,
        );
      }
    }
    results[key].summaries = summaries;
  }
  await browser.close();
  httpServer.close();
}

const fmt = (n) => (n == null ? '-' : n.toFixed(2));
const ratio = (a, b) => (a && b != null ? `${(b / a).toFixed(2)}x` : '-');
const others = NAMES.slice(1);
const lines = [
  `# Base UI SSR bench ${new Date().toISOString()}`,
  '',
  `runs ${RUNS} · warmup ${WARMUP} · production builds · variants ${NAMES.join(', ')}${process.argv[3] ? ` · filter ${process.argv[3]}` : ''}`,
  '',
  `| fixture | ${NAMES.map((n) => `${n} server ms / HTML bytes / hydrate ms / hydrate script ms`).join(' | ')} | ${others.map((n) => `${n}/${NAMES[0]} server / hydrate`).join(' | ')} |`,
  `|---|${NAMES.map(() => '---').join('|')}|${others.map(() => '---').join('|')}|`,
];
for (const key of keys) {
  const row = results[key];
  const cells = NAMES.map(
    (n) =>
      `${fmt(row[n].serverMs)} / ${row[n].htmlBytes} / ${fmt(row[n].hydrateCommitMs)} / ${fmt(row[n].hydrateScriptMs)}`,
  );
  const ratios = others.map(
    (n) =>
      `${ratio(row[NAMES[0]].serverMs, row[n].serverMs)} / ${ratio(row[NAMES[0]].hydrateCommitMs, row[n].hydrateCommitMs)}`,
  );
  lines.push(`| ${key} | ${cells.join(' | ')} | ${ratios.join(' | ')} |`);
}
if (problems.length) lines.push('', '## Problems', '', ...problems.map((p) => `- ${p}`));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.env.RESULTS_FILE ?? path.join(resultsDir, `ssr-${stamp}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  `${out}.json`,
  JSON.stringify(
    { variants: NAMES, runs: RUNS, filter: process.argv[3] ?? null, results, problems },
    null,
    2,
  ),
);
fs.writeFileSync(`${out}.md`, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nwritten ${out}.{md,json}`);
process.exit(problems.length ? 1 : 0);
