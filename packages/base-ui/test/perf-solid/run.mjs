// Runs the shared scenarios (`shared/scenarios/*.ts`) against the React and Solid production builds
// in Chromium. Each scenario runs in a fresh page per variant: WARMUP unmeasured cycles, then RUNS
// measured cycles of mount → steps → unmount. Variants are interleaved (two rounds) so their ratios
// are comparable within one session.
//
// Usage (from packages/base-ui, after `bun run bench:solid:build`):
//   node test/perf-solid/run.mjs [runs=8] [filter,...]     filter: scenario id prefixes
// Env: VARIANTS=name:lib:dir,...  THROTTLE=4  SIZE=large  WARMUP=2
// Exit code 1 when a step errors or a variant's DOM summary differs from the first variant's.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const builds = path.resolve(here, '../../../../.tmp/grunt/bench-builds');
const resultsDir = path.resolve(here, '../../../../.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 8);
const FILTERS = process.argv[3]?.split(',').filter(Boolean);
const WARMUP = Number(process.env.WARMUP ?? 2);
const THROTTLE = Number(process.env.THROTTLE ?? 1);
const QUERY = process.env.SIZE === 'large' ? '?size=large' : '';
const VARIANTS = Object.fromEntries(
  (process.env.VARIANTS ?? 'react:react:dist,solid:solid:dist').split(',').map((entry) => {
    const [name, lib, dir] = entry.split(':');
    return [name, { lib, dir }];
  }),
);
const NAMES = Object.keys(VARIANTS);
const KNOWN = JSON.parse(fs.readFileSync(path.join(here, 'known-differences.json'), 'utf8'));
const METRICS = ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'];

const server = http
  .createServer((req, res) => {
    const [name, ...rest] = req.url.split('?')[0].slice(1).split('/');
    const variant = VARIANTS[name];
    const file = variant && path.join(builds, variant.lib, variant.dir, rest.join('/') || 'index.html');
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const port = server.address().port;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const p90 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
};

async function openPage(browser, name) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 300)));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(`http://localhost:${port}/${name}/${QUERY}`);
  await page.waitForFunction(() => 'bench' in window);
  return { page, cdp, errors };
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]));
}

const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const probe = await openPage(browser, NAMES[0]);
const list = (await probe.page.evaluate(() => window.bench.list())).filter(
  (scenario) => !FILTERS || FILTERS.some((filter) => scenario.id.startsWith(filter)),
);
await probe.page.close();

const results = {};
const problems = [];
const knownHits = [];
for (const { id, steps } of list) {
  results[id] = {};
  for (let round = 0; round < 2; round += 1) {
    for (const name of NAMES) {
      const { page, cdp, errors } = await openPage(browser, name);
      const entry = (results[id][name] ??= { steps: {}, summaries: {}, heapKB: [], errors: [] });
      for (let run = 0; run < WARMUP + RUNS; run += 1) {
        await page.evaluate('gc()');
        const heapBefore = await page.evaluate('performance.memory.usedJSHeapSize');
        for (let index = 0; index < steps.length; index += 1) {
          const before = await metrics(cdp);
          const result = await page.evaluate(([scenario, step]) => window.bench.step(scenario, step), [
            id,
            index,
          ]);
          const after = await metrics(cdp);
          if (result.error) entry.errors.push(`${steps[index]}: ${result.error}`);
          if (run === WARMUP && round === 0) entry.summaries[steps[index]] = result.summary;
          if (run >= WARMUP) {
            const step = (entry.steps[steps[index]] ??= { sync: [], paint: [], script: [], layout: [], style: [] });
            step.sync.push(result.sync);
            step.paint.push(result.paint);
            step.script.push((after.ScriptDuration - before.ScriptDuration) * 1000);
            step.layout.push((after.LayoutDuration - before.LayoutDuration) * 1000);
            step.style.push((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000);
          }
          if (index === 0 && run >= WARMUP) {
            await page.evaluate('gc()');
            entry.heapKB.push(((await page.evaluate('performance.memory.usedJSHeapSize')) - heapBefore) / 1024);
          }
        }
      }
      entry.errors.push(...errors);
      await page.close();
    }
  }
  // A faster but broken variant must not count: DOM summaries must agree with the first variant.
  for (const name of NAMES.slice(1)) {
    for (const step of steps) {
      const expected = results[id][NAMES[0]].summaries[step];
      const actual = results[id][name].summaries[step];
      if (expected !== actual) {
        const known = KNOWN[id]?.[step];
        const delta = (summary) => JSON.parse(summary ?? 'null')?.nodes;
        // A known entry either allows a node delta (`nodesDelta`) or ignores named summary fields
        // (`fields`); every other part of the summary must still match.
        const without = (summary) => {
          const value = { ...JSON.parse(summary ?? '{}') };
          for (const field of known?.fields ?? []) delete value[field];
          if (known?.nodesDelta !== undefined) value.nodes = 0;
          return JSON.stringify(value);
        };
        const nodesOk =
          known?.nodesDelta === undefined || delta(actual) - delta(expected) === known.nodesDelta;
        if (known && nodesOk && without(actual) === without(expected)) {
          knownHits.push(`${id} › ${step}: ${known.reason}`);
        } else {
          problems.push(`${id} › ${step}: ${NAMES[0]} ${expected} ≠ ${name} ${actual}`);
        }
      }
    }
  }
  for (const name of NAMES) {
    for (const error of new Set(results[id][name].errors)) problems.push(`${id} [${name}] ${error}`);
  }
}
await browser.close();
server.close();

const fmt = (n) => (n == null ? '-' : n.toFixed(1));
const lines = [
  `# Base UI bench ${new Date().toISOString()}`,
  '',
  `runs ${RUNS} · warmup ${WARMUP} · throttle ${THROTTLE}x · size ${process.env.SIZE ?? 'default'} · variants ${NAMES.join(', ')}`,
  '',
  `| scenario › step | ${NAMES.map((n) => `${n} sync / paint / script`).join(' | ')} | ${NAMES[1]}/${NAMES[0]} sync | ${NAMES[1]}/${NAMES[0]} script |`,
  `|---|${NAMES.map(() => '---').join('|')}|---|---|`,
];
const summary = {};
for (const [id, byName] of Object.entries(results)) {
  for (const step of Object.keys(byName[NAMES[0]].steps)) {
    const cells = NAMES.map((name) => {
      const s = byName[name].steps[step];
      return `${fmt(median(s.sync))} / ${fmt(median(s.paint))} / ${fmt(median(s.script))}`;
    });
    const a = byName[NAMES[0]].steps[step];
    const b = byName[NAMES[1]]?.steps[step];
    const syncRatio = b ? median(b.sync) / median(a.sync) : null;
    const scriptRatio = b ? median(b.script) / Math.max(median(a.script), 0.01) : null;
    summary[`${id} › ${step}`] = {
      ...Object.fromEntries(
        NAMES.map((name) => {
          const s = byName[name].steps[step];
          return [name, { sync: median(s.sync), syncP90: p90(s.sync), paint: median(s.paint), script: median(s.script), layout: median(s.layout), style: median(s.style) }];
        }),
      ),
      syncRatio,
      scriptRatio,
    };
    lines.push(`| ${id} › ${step} | ${cells.join(' | ')} | ${syncRatio?.toFixed(2) ?? '-'}x | ${scriptRatio?.toFixed(2) ?? '-'}x |`);
  }
  lines.push(
    `| ${id} › heap after mount KB | ${NAMES.map((name) => fmt(median(byName[name].heapKB))).join(' | ')} | | |`,
  );
}
if (knownHits.length) {
  lines.push('', '## Known differences (known-differences.json)', '', ...knownHits.map((hit) => `- ${hit}`));
}
if (problems.length) {
  lines.push('', '## Problems', '', ...problems.map((problem) => `- ${problem}`));
}
fs.mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(resultsDir, `${stamp}.json`), JSON.stringify({ summary, problems }, null, 2));
fs.writeFileSync(path.join(resultsDir, `${stamp}.md`), lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nwritten ${path.join(resultsDir, stamp)}.{md,json}`);
process.exit(problems.length ? 1 : 0);
