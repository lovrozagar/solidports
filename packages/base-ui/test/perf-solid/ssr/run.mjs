// Server render + hydration benchmark, React (@base-ui/react) vs Solid (@solidports/base-ui), on
// identical fixtures (`<lib>/fixtures.tsx`). Production builds: a server bundle per library
// (`vite build --ssr`, framework packages external so Node resolves their server builds) and a
// hydratable client bundle per library.
//
// Usage (from packages/base-ui): node test/perf-solid/ssr/run.mjs [runs=20]
// Env: NO_BUILD=1 reuses the last builds; SERVER_ONLY=1 skips the browser (hydration) part.
// Results: <repo>/.tmp/grunt/bench-results/ssr-<timestamp>.{md,json}. Exit 1 when hydration
// logs a mismatch or the hydrated DOM summaries differ between libraries.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import solid from '@solidjs/vite-plugin';
import { build } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const packages = path.resolve(here, '../../../packages');
const repo = path.resolve(here, '../../../../..');
const builds = path.join(repo, '.tmp/grunt/bench-builds');
const resultsDir = path.join(repo, '.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 20);
const WARMUP = 3;
const LIBS = ['react', 'solid'];

const alias = {
  '@base-ui/react': path.join(packages, 'react/src'),
  '@base-ui/utils': path.join(packages, 'utils/src'),
  '@solidports/base-ui': path.join(packages, 'solid/src'),
};

function config(lib, ssr) {
  return {
    configFile: false,
    root: path.join(here, lib),
    mode: 'production',
    base: './',
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [lib === 'react' ? react() : solid({ ssr: true })],
    resolve: { alias, dedupe: ['react', 'react-dom', 'solid-js', '@solidjs/web'] },
    // Framework and utility packages stay external on the server, so Node resolves their
    // production server builds; the libraries' source is bundled.
    ssr: ssr ? { noExternal: [/@base-ui|@solidports/] } : undefined,
    build: ssr
      ? {
          ssr: path.join(here, lib, 'entry-server.tsx'),
          outDir: path.join(builds, `ssr-${lib}`, 'server'),
          emptyOutDir: true,
          minify: true,
        }
      : {
          outDir: path.join(builds, `ssr-${lib}`, 'client'),
          emptyOutDir: true,
          minify: true,
          chunkSizeWarningLimit: 99999,
        },
  };
}

if (!process.env.NO_BUILD) {
  for (const lib of LIBS) {
    await build(config(lib, true));
    await build(config(lib, false));
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// --- Server render (Node) ---
const server = {};
for (const lib of LIBS) {
  const entry = path.join(builds, `ssr-${lib}`, 'server', 'entry-server.mjs');
  server[lib] = await import(pathToFileURL(entry).href);
}
const keys = server.react.keys.filter((key) => server.solid.keys.includes(key));
const results = {};
const htmlByLib = {};
for (const key of keys) {
  results[key] = {};
  for (const lib of LIBS) {
    let html = '';
    const times = [];
    for (let run = 0; run < WARMUP + RUNS; run += 1) {
      const start = performance.now();
      html = server[lib].render(key);
      const elapsed = performance.now() - start;
      if (run >= WARMUP) times.push(elapsed);
    }
    (htmlByLib[lib] ??= {})[key] = html;
    results[key][lib] = { serverMs: median(times), htmlBytes: Buffer.byteLength(html) };
  }
}

// --- Hydration (Chromium) ---
const problems = [];
if (!process.env.SERVER_ONLY) {
  const { chromium } = await import('playwright');
  const templates = Object.fromEntries(
    LIBS.map((lib) => [
      lib,
      fs.readFileSync(path.join(builds, `ssr-${lib}`, 'client', 'index.html'), 'utf8'),
    ]),
  );
  const httpServer = http
    .createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const [lib, ...rest] = url.pathname.slice(1).split('/');
      if (!LIBS.includes(lib)) {
        res.writeHead(404).end();
        return;
      }
      if (rest.join('/') === '' || rest.join('/') === 'index.html') {
        const key = url.searchParams.get('fixture');
        const page = templates[lib]
          .replace('<!--ssr-head-->', server[lib].head())
          .replace('<!--ssr-outlet-->', htmlByLib[lib][key]);
        res.writeHead(200, { 'content-type': 'text/html' }).end(page);
        return;
      }
      const file = path.join(builds, `ssr-${lib}`, 'client', rest.join('/'));
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
    for (const lib of LIBS) {
      const sync = [];
      const script = [];
      const total = [];
      for (let run = 0; run < WARMUP + RUNS; run += 1) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (message) => {
          const text = message.text();
          if (/hydrat|mismatch|unclaimed/i.test(text)) logs.push(text.slice(0, 200));
        });
        page.on('pageerror', (error) => logs.push(`pageerror: ${String(error).slice(0, 200)}`));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await page.goto(`http://localhost:${port}/${lib}/?fixture=${encodeURIComponent(key)}`);
        await page.waitForFunction(() => '__hydrate' in window);
        const before = await cdp.send('Performance.getMetrics');
        const result = await page.evaluate(
          async ([fixture, settleSource]) => {
            const settleFn = new Function(`return (${settleSource})()`);
            const start = performance.now();
            const syncMs = window.__hydrate(fixture);
            await settleFn();
            return { syncMs, totalMs: performance.now() - start };
          },
          [key, settle.toString()],
        );
        const after = await cdp.send('Performance.getMetrics');
        const metric = (list, name) => list.metrics.find((m) => m.name === name)?.value ?? 0;
        if (run >= WARMUP) {
          sync.push(result.syncMs);
          total.push(result.totalMs);
          script.push((metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) * 1000);
        }
        if (run === WARMUP) {
          summaries[lib] = await page.evaluate(() => ({
            nodes: document.body.querySelectorAll('*').length,
            expanded: document.querySelectorAll('[aria-expanded="true"]').length,
            checkboxes: document.querySelectorAll('[role="checkbox"]').length,
            dialog: document.querySelectorAll('[role="dialog"]').length,
            tabsSelected: document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
            labelled: document.querySelectorAll('[aria-labelledby]').length,
          }));
          for (const log of new Set(logs)) problems.push(`${key} [${lib}] ${log}`);
        }
        await page.close();
      }
      Object.assign(results[key][lib], {
        hydrateSyncMs: median(sync),
        hydrateTotalMs: median(total),
        hydrateScriptMs: median(script),
      });
    }
    if (JSON.stringify(summaries.react) !== JSON.stringify(summaries.solid)) {
      problems.push(
        `${key}: hydrated DOM differs: react ${JSON.stringify(summaries.react)} ≠ solid ${JSON.stringify(summaries.solid)}`,
      );
    }
    results[key].summaries = summaries;
  }
  await browser.close();
  httpServer.close();
}

const fmt = (n) => (n == null ? '-' : n.toFixed(2));
const ratio = (a, b) => (a && b != null ? `${(b / a).toFixed(2)}x` : '-');
const lines = [
  `# Base UI SSR bench ${new Date().toISOString()}`,
  '',
  `runs ${RUNS} · warmup ${WARMUP} · production builds`,
  '',
  '| fixture | server ms R / S | ratio | HTML bytes R / S | hydrate sync ms R / S | ratio | hydrate script ms R / S | ratio |',
  '|---|---|---|---|---|---|---|---|',
];
for (const key of keys) {
  const r = results[key].react;
  const s = results[key].solid;
  lines.push(
    `| ${key} | ${fmt(r.serverMs)} / ${fmt(s.serverMs)} | ${ratio(r.serverMs, s.serverMs)} | ${r.htmlBytes} / ${s.htmlBytes} | ${fmt(r.hydrateSyncMs)} / ${fmt(s.hydrateSyncMs)} | ${ratio(r.hydrateSyncMs, s.hydrateSyncMs)} | ${fmt(r.hydrateScriptMs)} / ${fmt(s.hydrateScriptMs)} | ${ratio(r.hydrateScriptMs, s.hydrateScriptMs)} |`,
  );
}
if (problems.length) lines.push('', '## Problems', '', ...problems.map((p) => `- ${p}`));
fs.mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(resultsDir, `ssr-${stamp}.json`),
  JSON.stringify({ results, problems }, null, 2),
);
fs.writeFileSync(path.join(resultsDir, `ssr-${stamp}.md`), lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nwritten ${path.join(resultsDir, `ssr-${stamp}`)}.{md,json}`);
process.exit(problems.length ? 1 : 0);
