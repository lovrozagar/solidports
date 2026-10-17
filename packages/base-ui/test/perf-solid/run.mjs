// Runs the shared scenarios (`shared/scenarios/*.ts`) against the React and Solid production builds
// in Chromium. Each scenario runs in a fresh page per variant: WARMUP unmeasured cycles, then RUNS
// timing cycles of mount → steps → unmount, then HEAP_RUNS heap cycles (`shared/cycles.mjs`).
// Variants are interleaved (two rounds) so their ratios are comparable within one session.
//
// Usage (from packages/base-ui, after `bun run bench:solid:build`):
//   node test/perf-solid/run.mjs [runs=8] [filter,...]     filter: `shared/filter.mjs` terms
//   (id prefix, component:<name>, tag:<tag>, ! to exclude)
// Env: VARIANTS=name:lib:dir,...  THROTTLE=4  SIZE=large  WARMUP=2  HEAP_RUNS=6
//   ENGINE=chromium|firefox|webkit (`shared/engines.mjs`): Firefox and WebKit time steps in the
//   page only; script, layout, style and heap are CDP's and Chromium's, reported as not measured.
// Exit code 1 when a step errors, a page logs a console warning or error that
// `known-warnings.json` does not list (`shared/console.mjs`), or a variant's DOM summary differs
// from the first variant's.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { matchConsole } from './shared/console.mjs';
import { matchesFilter, parseFilter } from './shared/filter.mjs';
import { heapCycle, timingCycle } from './shared/cycles.mjs';
import { engineSpec, measuredColumns } from './shared/engines.mjs';
import { assertScriptMetric, collectGarbage, evaluateInTask } from './shared/measure.mjs';
import { summarize } from './shared/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const builds = path.resolve(here, '../../../../.tmp/grunt/bench-builds');
const resultsDir = path.resolve(here, '../../../../.tmp/grunt/bench-results');
const RUNS = Number(process.argv[2] ?? 8);
const WARMUP = Number(process.env.WARMUP ?? 2);
const HEAP_RUNS = Number(process.env.HEAP_RUNS ?? 6);
const THROTTLE = Number(process.env.THROTTLE ?? 1);
const QUERY = process.env.SIZE === 'large' ? '?size=large' : '';
const ENGINE = engineSpec(process.env.ENGINE);
const COLUMNS = measuredColumns(ENGINE);
if (THROTTLE > 1 && !ENGINE.cdp) {
  console.error(`bench: THROTTLE needs CDP, which ${ENGINE.name} does not have.`);
  process.exit(1);
}
const VARIANTS = Object.fromEntries(
  (process.env.VARIANTS ?? 'react:react:dist,solid:solid:dist').split(',').map((entry) => {
    const [name, lib, dir] = entry.split(':');
    return [name, { lib, dir }];
  }),
);
const NAMES = Object.keys(VARIANTS);
const KNOWN = JSON.parse(fs.readFileSync(path.join(here, 'known-differences.json'), 'utf8'));
const KNOWN_CONSOLE = JSON.parse(
  fs.readFileSync(path.join(here, 'known-warnings.json'), 'utf8'),
).entries;
const METRICS = ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration'];

const server = http
  .createServer((req, res) => {
    const [name, ...rest] = req.url.split('?')[0].slice(1).split('/');
    const variant = VARIANTS[name];
    const file =
      variant && path.join(builds, variant.lib, variant.dir, rest.join('/') || 'index.html');
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const port = server.address().port;

async function openPage(browser, name) {
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 300)));
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'warning' || type === 'error') {
      logs.push({
        kind: type === 'warning' ? 'warn' : 'error',
        text: message.text().slice(0, 300),
      });
    }
  });
  const cdp = ENGINE.cdp ? await page.context().newCDPSession(page) : null;
  if (cdp) {
    await cdp.send('Performance.enable');
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }
  await page.goto(`http://localhost:${port}/${name}/${QUERY}`);
  await page.waitForFunction(() => 'bench' in window);
  return { page, cdp, errors, logs };
}

async function metrics(cdp) {
  if (!cdp) {
    return null;
  }
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(
    list.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]),
  );
}

const browser = await { chromium, firefox, webkit }[ENGINE.name].launch({ args: ENGINE.launchArgs });
const probe = await openPage(browser, NAMES[0]);
if (probe.cdp) {
  await assertScriptMetric(probe.page, probe.cdp);
}
const all = await probe.page.evaluate(() => window.bench.list());
const vocab = await probe.page.evaluate(() => window.bench.vocab);
let FILTER;
try {
  FILTER = parseFilter(process.argv[3], { ids: all.map((s) => s.id), ...vocab });
} catch (error) {
  console.error(error.message);
  await browser.close();
  process.exit(1);
}
const list = all.filter((scenario) => matchesFilter(scenario, FILTER));
await probe.page.close();
if (list.length === 0) {
  console.error(`No scenario matches "${process.argv[3]}"`);
  await browser.close();
  process.exit(1);
}

const results = {};
const problems = [];
const knownHits = [];
/** Every console warning and error the pages logged, by scenario and variant. */
const consoleEntries = [];
const timers = Object.fromEntries(list.map((scenario) => [scenario.id, scenario.timers]));
for (const { id, steps } of list) {
  results[id] = {};
  for (let round = 0; round < 2; round += 1) {
    for (const name of NAMES) {
      const { page, cdp, errors, logs } = await openPage(browser, name);
      const entry = (results[id][name] ??= { steps: {}, summaries: {}, heapKB: [], errors: [] });
      // Without CDP there is no forced full collection: the cycles skip it.
      const collect = cdp ? () => collectGarbage(cdp) : async () => {};
      const readHeap = () => page.evaluate('performance.memory.usedJSHeapSize');
      const runStep = async (index) => {
        const before = await metrics(cdp);
        // In a task of its own, so `script` counts a synchronous step (`shared/measure.mjs`).
        const result = await evaluateInTask(
          page,
          ([scenario, step]) => window.bench.step(scenario, step),
          [id, index],
        );
        const after = await metrics(cdp);
        return { result, before, after };
      };
      const stepCount = steps.length;
      for (let run = 0; run < WARMUP + RUNS; run += 1) {
        const timed = await timingCycle({ collect, runStep, stepCount });
        timed.forEach(({ result, before, after }, index) => {
          if (result.error) entry.errors.push(`${steps[index]}: ${result.error}`);
          if (run === WARMUP && round === 0) entry.summaries[steps[index]] = result.summary;
          if (run < WARMUP) return;
          const step = (entry.steps[steps[index]] ??= {
            sync: [],
            paint: [],
            script: [],
            layout: [],
            style: [],
            settled: [],
          });
          step.sync.push(result.sync);
          step.paint.push(result.paint);
          if (before && after) {
            step.script.push((after.ScriptDuration - before.ScriptDuration) * 1000);
            step.layout.push((after.LayoutDuration - before.LayoutDuration) * 1000);
            step.style.push((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000);
          }
          if (result.settled !== null) step.settled.push(result.settled);
        });
      }
      for (let run = 0; ENGINE.heap && run < HEAP_RUNS; run += 1) {
        entry.heapKB.push(await heapCycle({ collect, readHeap, runStep, stepCount }));
      }
      entry.errors.push(...errors);
      consoleEntries.push(...logs.map((log) => ({ scenario: id, variant: name, ...log })));
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
    for (const error of new Set(results[id][name].errors))
      problems.push(`${id} [${name}] ${error}`);
  }
}
await browser.close();
server.close();

const consoleCheck = matchConsole(consoleEntries, KNOWN_CONSOLE);
for (const entry of consoleCheck.unknown) {
  problems.push(`${entry.scenario} [${entry.variant}] console.${entry.kind}: ${entry.text}`);
}

const fmt = (n) => (n == null ? '-' : n.toFixed(1));
// A ratio of a column the engine does not measure is `-`, not `NaNx`.
const ratio = (n) => (Number.isFinite(n) ? `${n.toFixed(2)}x` : '-');
const summary = summarize(results, NAMES, timers);
const ratioNames = NAMES.slice(1).map((name) => `${name}/${NAMES[0]}`);
const lines = [
  `# Base UI bench ${new Date().toISOString()}`,
  '',
  `runs ${RUNS} · warmup ${WARMUP} · throttle ${THROTTLE}x · size ${process.env.SIZE ?? 'default'} · variants ${NAMES.join(', ')}${process.argv[3] ? ` · filter ${process.argv[3]}` : ''}`,
  ENGINE.cdp
    ? `engine ${ENGINE.name}`
    : `engine ${ENGINE.name}: script, layout, style and heap are not measured (CDP and \`performance.memory\` are Chromium's); \`-\` marks them`,
  '',
  "settled: ms from step start until `until` held, minus the step's `timerMs` (steps with `until` only).",
  '',
  `| scenario › step | ${NAMES.map((n) => `${n} sync / paint / script / settled`).join(' | ')} | ${ratioNames.map((r) => `${r} sync / script`).join(' | ')} |`,
  `|---|${NAMES.map(() => '---').join('|')}|${ratioNames.map(() => '---').join('|')}|`,
];
for (const [key, entry] of Object.entries(summary)) {
  if (key.endsWith('heap after mount KB')) {
    lines.push(
      `| ${key} | ${NAMES.map((name) => fmt(entry[name].heapKB)).join(' | ')} | ${ratioNames.map(() => '').join(' | ')} |`,
    );
    continue;
  }
  const cells = NAMES.map((name) => {
    const v = entry[name];
    return `${fmt(v.sync)} / ${fmt(v.paint)} / ${fmt(v.script)} / ${fmt(v.settled)}`;
  });
  const ratios = ratioNames.map(
    (r) => `${ratio(entry.ratios[r].sync)} / ${ratio(entry.ratios[r].script)}`,
  );
  lines.push(`| ${key} | ${cells.join(' | ')} | ${ratios.join(' | ')} |`);
}
if (knownHits.length) {
  lines.push(
    '',
    '## Known differences (known-differences.json)',
    '',
    ...knownHits.map((hit) => `- ${hit}`),
  );
}
if (consoleCheck.known.length) {
  const counts = new Map();
  for (const hit of consoleCheck.known) {
    const key = `${hit.variant} console.${hit.kind}: ${hit.reason}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  lines.push(
    '',
    '## Known console messages (known-warnings.json)',
    '',
    ...[...counts].map(([key, count]) => `- ${count}× ${key}`),
  );
}
if (problems.length) {
  lines.push('', '## Problems', '', ...problems.map((problem) => `- ${problem}`));
}
fs.mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
// RESULTS_FILE (a path without extension) lets a driver read the result it asked for.
const out = process.env.RESULTS_FILE ?? path.join(resultsDir, stamp);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  `${out}.json`,
  JSON.stringify(
    {
      variants: NAMES,
      engine: ENGINE.name,
      columns: COLUMNS,
      runs: RUNS,
      filter: process.argv[3] ?? null,
      raw: list.filter((scenario) => scenario.tags.includes('raw')).map((scenario) => scenario.id),
      summary,
      console: consoleEntries,
      problems,
    },
    null,
    2,
  ),
);
fs.writeFileSync(`${out}.md`, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nwritten ${out}.{md,json}`);
process.exit(problems.length ? 1 : 0);
