// Server render + hydration benchmark, React (@base-ui/react) vs Solid (@solidports/base-ui), on
// identical fixtures (cases in `cases.ts`, registered by `<lib>/fixtures/<component>.tsx`).
// Production builds: a server bundle per variant (`vite build --ssr`, framework packages external
// so Node resolves their server builds) and a hydratable client bundle per variant.
//
// Usage (from packages/base-ui): node --expose-gc test/perf-solid/ssr/run.mjs [runs=20] [filter,...]
//   filter: as `../run.mjs`, terms from `../shared/filter.mjs` (id prefix, component:, tag:, !)
// Env:
//   SSR_VARIANTS=name:lib[:solidSrc[:outDir]],...  default react:react,solid:solid; a Solid variant
//     may build from another copy of the library source (a baseline) into its own build folder
//     (default ssr-<name>). Ratios are taken against the first.
//   NO_BUILD=1 reuses every build; NO_BUILD=a,b reuses those variants' builds only.
//   BUILD_ONLY=1 builds and exits. SERVER_ONLY=1 skips the browser (hydration) part.
//   SSR_MINIFY=0 keeps the bundles readable (function names for profile.mjs).
//   SSR_SOURCEMAP=1 writes sourcemaps (the profiling pass, `../attribution.mjs`).
//   RESULTS_FILE=<path without extension>.
//   SSR_REPEAT=name:N renders that variant's case N times per server render: a known slowdown, to
//     check that the instrument sees it (`bench:component` never sets it).
// Server ms: each sample is the mean of a batch of renders, the heap collected before each batch
// (`sample.mjs` says why); `--expose-gc` is required.
// Hydrate ms runs from the hydrate call to the commit: React's root layout effect (`hydrateRoot` is
// concurrent, so its sync time is only scheduling), Solid's `hydrate` plus `flush`. Then the first
// expanded trigger is clicked: first close ms runs from the click through two settled frames, and
// its script ms is the CDP `ScriptDuration` change, so work a part defers past hydration counts.
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
import { assertScriptMetric, evaluateInTask } from '../shared/measure.mjs';
import { balancedOrders } from '../shared/order.mjs';
import { median } from '../shared/regression.mjs';
import { SERVER_SAMPLING, sampleServer } from './sample.mjs';
import { mainThreadLines } from '../shared/report.mjs';
import { DEAD_TRIGGER, checkMode, measureInteraction } from './interact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packages = path.resolve(here, '../../../packages');
const repo = path.resolve(here, '../../../../..');
const builds = path.join(repo, '.tmp/grunt/bench-builds');
const resultsDir = path.join(repo, '.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 20);
/**
 * CDP main-thread metrics per hydration step: sample name, metric, scale to ms or count.
 * `TaskDuration` counts script run inside a DevTools evaluate, as Solid's synchronous hydrate is
 * here; `ScriptDuration` does not.
 */
const LAYOUT_METRICS = [
  ['TaskMs', 'TaskDuration', 1000],
  ['LayoutMs', 'LayoutDuration', 1000],
  ['StyleMs', 'RecalcStyleDuration', 1000],
  ['Layouts', 'LayoutCount', 1],
  ['Styles', 'RecalcStyleCount', 1],
];
const WARMUP = 3;
// D29: TTI and INP under CPU throttling (`CPU_THROTTLE=4`, as a phone); off by default.
const CPU_THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
// D29: `SSR_CHECK=webkit` checks the interactive cases in WebKit, pass or fail, untimed.
const CHECK = checkMode(process.env);

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
const orders = balancedOrders(NAMES);
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
        // The raw-Solid floors come from the same package copy as the library (D30).
        '@solidports/base-ui-floor': path.join(src, '../test/floor'),
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
          sourcemap: process.env.SSR_SOURCEMAP === '1',
        }
      : {
          outDir: path.join(outDir(name), 'client'),
          emptyOutDir: true,
          minify: process.env.SSR_MINIFY !== '0',
          sourcemap: process.env.SSR_SOURCEMAP === '1',
          chunkSizeWarningLimit: 99999,
        },
  };
}

const reuse = process.env.NO_BUILD === '1' ? NAMES : (process.env.NO_BUILD ?? '').split(',');
for (const name of NAMES) {
  if (reuse.includes(name)) {
    continue;
  }
  await build(config(name, true));
  await build(config(name, false));
}
if (process.env.BUILD_ONLY) {
  process.exit(0);
}

// --- Server render (Node) ---
const server = {};
/** `SSR_REPEAT`: renders per server render, per variant (1 unless set). */
const REPEAT = Object.fromEntries(
  (process.env.SSR_REPEAT ?? '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [name, count] = entry.split(':');
      return [name, Number(count)];
    }),
);
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
/** Renders per server sample, per case. */
const serverBatch = {};
for (const key of keys) {
  results[key] = {};
  for (const name of NAMES) {
    results[key][name] = {
      samples: {
        serverMs: [],
        hydrateSyncMs: [],
        hydrateCommitMs: [],
        hydrateScriptMs: [],
        firstCloseMs: [],
        firstCloseScriptMs: [],
        // D29, the cases with an interaction: navigation to the first click handled (gated), the
        // hydration commit on that load, and its script time and client bundle bytes.
        ttiMs: [],
        inpFirstMs: [],
        inpMs: [],
        hydrateLoadCommitMs: [],
        loadScriptMs: [],
        bundleBytes: [],
        ...Object.fromEntries(
          LAYOUT_METRICS.flatMap(([sample]) => [
            [`commit${sample}`, []],
            [`settle${sample}`, []],
          ]),
        ),
      },
    };
  }
  for (const name of NAMES) {
    (html[name] ??= {})[key] = server[name].render(key);
  }
  const sampled = sampleServer(
    Object.fromEntries(
      NAMES.map((name) => {
        const repeat = REPEAT[name] ?? 1;
        return [
          name,
          () => {
            for (let i = 0; i < repeat; i += 1) {
              server[name].render(key);
            }
          },
        ];
      }),
    ),
    { ...SERVER_SAMPLING, runs: RUNS, gc: globalThis.gc },
  );
  serverBatch[key] = sampled.batch;
  for (const name of NAMES) {
    const entry = results[key][name];
    entry.samples.serverMs = sampled.samples[name];
    entry.serverMs = median(entry.samples.serverMs);
    entry.htmlBytes = Buffer.byteLength(html[name][key]);
  }
}

// --- Hydration (Chromium) ---
const problems = [];
if (!process.env.SERVER_ONLY) {
  const playwright = await import('playwright');
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
  const browser = await playwright[CHECK ?? 'chromium'].launch();
  if (!CHECK) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await assertScriptMetric(page, cdp);
    await page.close();
  }
  // The check: each interactive case once per variant, failing on a dead trigger or a hydration
  // error; nothing timed.
  for (const key of CHECK ? keys : []) {
    const interaction = first.cases.find((c) => c.id === key)?.interaction;
    for (const name of interaction ? NAMES : []) {
      const url = `http://localhost:${port}/${name}/?fixture=${encodeURIComponent(key)}&auto=1`;
      try {
        const { page } = await measureInteraction(browser, url, interaction, {
          cdp: false,
          onPage: (opened) => {
            opened.on('console', (message) => {
              if (/hydrat|mismatch|unclaimed/i.test(message.text())) {
                problems.push(`${key} [${name}, ${CHECK}] ${message.text().slice(0, 200)}`);
              }
            });
            opened.on('pageerror', (error) =>
              problems.push(`${key} [${name}, ${CHECK}] pageerror: ${String(error).slice(0, 200)}`),
            );
          },
        });
        await page.close();
      } catch (error) {
        problems.push(
          `${key} [${name}, ${CHECK}] ${String(error?.message ?? error).slice(0, 200)}`,
        );
      }
    }
  }
  for (const key of CHECK ? [] : keys) {
    const summaries = {};
    const total = Object.fromEntries(NAMES.map((name) => [name, []]));
    for (let run = 0; run < WARMUP + RUNS; run += 1) {
      // A balanced order, changed run by run, as the server sampling's (`shared/order.mjs`).
      for (const name of orders[run % orders.length]) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (message) => {
          const text = message.text();
          if (/hydrat|mismatch|unclaimed/i.test(text)) {
            logs.push(text.slice(0, 200));
          }
        });
        page.on('pageerror', (error) => logs.push(`pageerror: ${String(error).slice(0, 200)}`));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await page.goto(`http://localhost:${port}/${name}/?fixture=${encodeURIComponent(key)}`);
        await page.waitForFunction(() => '__hydrate' in window);
        const before = await cdp.send('Performance.getMetrics');
        // Two steps, with the metrics read between them: up to the commit (a layout or style
        // recalculation there is forced by script), then the two settled frames.
        // In a task of its own, so `script` counts Solid's synchronous hydrate (`shared/measure.mjs`).
        const committed = await evaluateInTask(
          page,
          (fixture) => {
            window.__benchStart = performance.now();
            const { syncMs, committed: done } = window.__hydrate(fixture);
            return done.then((commitMs) => ({ syncMs, commitMs }));
          },
          key,
        );
        const atCommit = await cdp.send('Performance.getMetrics');
        const totalMs = await page.evaluate(async () => {
          // Two frames and a task: what the page's hydration work schedules has run.
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
          });
          return performance.now() - window.__benchStart;
        });
        const result = { ...committed, totalMs };
        const after = await cdp.send('Performance.getMetrics');
        const metric = (list, metricName) =>
          list.metrics.find((m) => m.name === metricName)?.value ?? 0;
        const delta = (from, to, metricName) => metric(to, metricName) - metric(from, metricName);
        if (run >= WARMUP) {
          const samples = results[key][name].samples;
          samples.hydrateSyncMs.push(result.syncMs);
          samples.hydrateCommitMs.push(result.commitMs);
          samples.hydrateScriptMs.push(delta(before, after, 'ScriptDuration') * 1000);
          for (const [sample, metricName, scale] of LAYOUT_METRICS) {
            samples[`commit${sample}`].push(delta(before, atCommit, metricName) * scale);
            samples[`settle${sample}`].push(delta(atCommit, after, metricName) * scale);
          }
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
          for (const log of new Set(logs)) {
            problems.push(`${key} [${name}] ${log}`);
          }
        }
        const beforeClose = await cdp.send('Performance.getMetrics');
        const closeMs = await page.evaluate(async () => {
          const trigger = document.querySelector('[aria-expanded="true"]');
          if (!trigger) {
            return null;
          }
          const start = performance.now();
          trigger.click();
          // Two frames and a task, as after hydration.
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
          });
          return performance.now() - start;
        });
        const afterClose = await cdp.send('Performance.getMetrics');
        if (run >= WARMUP && closeMs != null) {
          const samples = results[key][name].samples;
          samples.firstCloseMs.push(closeMs);
          samples.firstCloseScriptMs.push(
            (metric(afterClose, 'ScriptDuration') - metric(beforeClose, 'ScriptDuration')) * 1000,
          );
        }
        await page.close();
      }
    }
    const interaction = first.cases.find((c) => c.id === key)?.interaction;
    // A cold load per run and variant, clicked from the first paint (`interact.mjs`).
    let dead = false;
    for (let run = 0; interaction && !dead && run < WARMUP + RUNS; run += 1) {
      for (const name of orders[run % orders.length]) {
        const url = `http://localhost:${port}/${name}/?fixture=${encodeURIComponent(key)}&auto=1`;
        let measured;
        try {
          measured = await measureInteraction(browser, url, interaction, {
            throttle: CPU_THROTTLE,
          });
        } catch (error) {
          if (String(error?.message).startsWith(DEAD_TRIGGER)) {
            // A dead trigger fails the case outright: no further loads of it.
            problems.push(`${key} [${name}] ${error.message}`);
            dead = true;
            break;
          }
          throw error;
        }
        await measured.page.close();
        if (run >= WARMUP) {
          const samples = results[key][name].samples;
          samples.ttiMs.push(measured.ttiMs);
          samples.inpFirstMs.push(measured.inpFirstMs);
          samples.inpMs.push(measured.inpMs);
          samples.loadScriptMs.push(measured.scriptMs);
          samples.bundleBytes.push(measured.bundleBytes);
          if (measured.hydrateLoadCommitMs != null) {
            samples.hydrateLoadCommitMs.push(measured.hydrateLoadCommitMs);
          }
        }
      }
    }
    for (const name of NAMES) {
      const entry = results[key][name];
      for (const metric of [
        'ttiMs',
        'inpFirstMs',
        'inpMs',
        'hydrateLoadCommitMs',
        'loadScriptMs',
        'bundleBytes',
      ]) {
        entry[metric] = entry.samples[metric].length ? median(entry.samples[metric]) : null;
      }
      entry.hydrateSyncMs = median(entry.samples.hydrateSyncMs);
      entry.hydrateCommitMs = median(entry.samples.hydrateCommitMs);
      entry.hydrateTotalMs = median(total[name]);
      entry.hydrateScriptMs = median(entry.samples.hydrateScriptMs);
      for (const [sample] of LAYOUT_METRICS) {
        entry[`commit${sample}`] = median(entry.samples[`commit${sample}`]);
        entry[`settle${sample}`] = median(entry.samples[`settle${sample}`]);
      }
      entry.firstCloseMs = entry.samples.firstCloseMs.length
        ? median(entry.samples.firstCloseMs)
        : null;
      entry.firstCloseScriptMs = entry.samples.firstCloseScriptMs.length
        ? median(entry.samples.firstCloseScriptMs)
        : null;
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
/** Hydration and first-close script time together: what deferring work past hydration can't hide. */
const withClose = (entry) => entry.hydrateScriptMs + (entry.firstCloseScriptMs ?? 0);
const lines = [
  `# Base UI SSR bench ${new Date().toISOString()}`,
  '',
  `runs ${RUNS} · hydration warmup ${WARMUP}${CPU_THROTTLE > 1 ? ` · CPU ${CPU_THROTTLE}x slower` : ''} · server warmup ${SERVER_SAMPLING.warmup}, samples: batch means (${keys.map((key) => `${key} ×${serverBatch[key]}`).join(', ')}), GC before each batch · production builds · variants ${NAMES.join(', ')}${process.argv[3] ? ` · filter ${process.argv[3]}` : ''}`,
  '',
  `| fixture | ${NAMES.map((n) => `${n} server ms / HTML bytes / hydrate ms / hydrate script ms / first close ms / close script ms`).join(' | ')} | ${others.map((n) => `${n}/${NAMES[0]} server / hydrate / hydrate+close script`).join(' | ')} |`,
  `|---|${NAMES.map(() => '---').join('|')}|${others.map(() => '---').join('|')}|`,
];
for (const key of keys) {
  const row = results[key];
  const cells = NAMES.map(
    (n) =>
      `${fmt(row[n].serverMs)} / ${row[n].htmlBytes} / ${fmt(row[n].hydrateCommitMs)} / ${fmt(row[n].hydrateScriptMs)} / ${fmt(row[n].firstCloseMs)} / ${fmt(row[n].firstCloseScriptMs)}`,
  );
  const ratios = others.map(
    (n) =>
      `${ratio(row[NAMES[0]].serverMs, row[n].serverMs)} / ${ratio(row[NAMES[0]].hydrateCommitMs, row[n].hydrateCommitMs)} / ${ratio(withClose(row[NAMES[0]]), withClose(row[n]))}`,
  );
  lines.push(`| ${key} | ${cells.join(' | ')} | ${ratios.join(' | ')} |`);
}
lines.push(...mainThreadLines(keys, results, NAMES));
if (problems.length) {
  lines.push('', '## Problems', '', ...problems.map((p) => `- ${p}`));
}
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
