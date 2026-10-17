// CPU and allocation profile of one SSR case, server render or hydration, on the production
// builds `run.mjs` writes. Build them readable first:
//   SSR_MINIFY=0 BUILD_ONLY=1 SSR_VARIANTS=solid:solid node test/perf-solid/ssr/run.mjs
//
// Usage (from packages/base-ui):
//   node test/perf-solid/ssr/profile.mjs server <build> <case> [renders=300]
//   node test/perf-solid/ssr/profile.mjs hydrate <build> <case> [pages=15]
//   <build>: a folder under .tmp/grunt/bench-builds (e.g. ssr-solid)
//
// server: self time and sampled allocations (objects collected since included) per render, after
// warmup. hydrate: a fresh Chromium page per sample, self time per page and the median time to the
// commit. Both then time the case against its `<case>-floor` twin, when the build registers one,
// in interleaved batches, and print the median ratio: it holds under machine load. Run with
// `--no-turbo-inlining --no-maglev-inlining` for exact server allocation attribution.
import fs from 'node:fs';
import http from 'node:http';
import inspector from 'node:inspector/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const builds = path.resolve(here, '../../../../../.tmp/grunt/bench-builds');
const [mode, build, key, countArg] = process.argv.slice(2);
if (!['server', 'hydrate'].includes(mode) || !build || !key) {
  console.error('usage: profile.mjs <server|hydrate> <build> <case> [count]');
  process.exit(1);
}
const dir = path.join(builds, build);
const server = await import(pathToFileURL(path.join(dir, 'server/entry-server.mjs')).href);
const floorKey = `${key}-floor`;
const hasFloor = server.keys.includes(floorKey);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const label = (frame) =>
  `${frame.functionName || '(anon)'} ${path.basename(frame.url)}:${frame.lineNumber + 1}`;

/** Self time by function, summed over `profiles`, per `per` units, top `top`. */
function selfTime(profiles, per, top = 40) {
  const selfMs = new Map();
  for (const profile of profiles) {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => {
      const name = label(byId.get(id).callFrame);
      selfMs.set(name, (selfMs.get(name) ?? 0) + (profile.timeDeltas[i] ?? 0));
    });
  }
  return [...selfMs]
    .filter(([name]) => !name.startsWith('(idle)') && !name.startsWith('(program)'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, us]) => `${(us / per).toFixed(1).padStart(8)} µs ${name}`);
}

if (mode === 'server') {
  const renders = Number(countArg ?? 300);
  for (let i = 0; i < 100; i += 1) {
    server.render(key);
  }
  const session = new inspector.Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: 20 });
  await session.post('Profiler.start');
  const start = performance.now();
  for (let i = 0; i < renders; i += 1) {
    server.render(key);
  }
  const ms = (performance.now() - start) / renders;
  const { profile } = await session.post('Profiler.stop');
  await session.post('HeapProfiler.enable');
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 256,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  for (let i = 0; i < renders; i += 1) {
    server.render(key);
  }
  const { profile: heap } = await session.post('HeapProfiler.stopSampling');
  const allocated = new Map();
  let total = 0;
  const walk = (node) => {
    const name = label(node.callFrame);
    allocated.set(name, (allocated.get(name) ?? 0) + node.selfSize);
    total += node.selfSize;
    node.children.forEach(walk);
  };
  walk(heap.head);
  console.log(`${key}: ${ms.toFixed(3)} ms per render (profiled)`);
  console.log(`\nallocated ${(total / 1024 / renders).toFixed(1)} KB per render, top by self:`);
  for (const [name, bytes] of [...allocated].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`${(bytes / 1024 / renders).toFixed(2).padStart(8)} KB ${name}`);
  }
  console.log('\nCPU self time per render:');
  console.log(selfTime([profile], renders).join('\n'));
  if (hasFloor) {
    const batch = (name) => {
      const t = performance.now();
      for (let i = 0; i < 10; i += 1) {
        server.render(name);
      }
      return (performance.now() - t) / 10;
    };
    for (let i = 0; i < 50; i += 1) {
      server.render(key);
      server.render(floorKey);
    }
    const port = [];
    const floor = [];
    for (let i = 0; i < 41; i += 1) {
      port.push(batch(key));
      floor.push(batch(floorKey));
    }
    console.log(
      `\nserver vs floor: ${median(port).toFixed(3)} / ${median(floor).toFixed(3)} ms = ${(median(port) / median(floor)).toFixed(2)}x`,
    );
  }
  process.exit(0);
}

// --- Hydration (Chromium) ---
const { chromium } = await import('playwright');
const template = fs.readFileSync(path.join(dir, 'client/index.html'), 'utf8');
const page = (name) =>
  template
    .replace('<!--ssr-head-->', server.head())
    .replace('<!--ssr-outlet-->', server.render(name));
const pages = { [key]: page(key), ...(hasFloor ? { [floorKey]: page(floorKey) } : {}) };
const httpServer = http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res
        .writeHead(200, { 'content-type': 'text/html' })
        .end(pages[url.searchParams.get('fixture')]);
      return;
    }
    const file = path.join(dir, 'client', url.pathname);
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/css' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const browser = await chromium.launch();
const origin = `http://localhost:${httpServer.address().port}`;

/** Hydrates `name` on a fresh page; returns its commit time and, when asked, its CPU profile. */
async function hydrateOnce(name, profiled) {
  const tab = await browser.newPage();
  await tab.goto(`${origin}/?fixture=${encodeURIComponent(name)}`);
  await tab.waitForFunction(() => '__hydrate' in window);
  const cdp = profiled ? await tab.context().newCDPSession(tab) : undefined;
  if (cdp) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 25 });
    await cdp.send('Profiler.start');
  }
  const ms = await tab.evaluate((fixture) => window.__hydrate(fixture).committed, name);
  const profile = cdp ? (await cdp.send('Profiler.stop')).profile : undefined;
  await tab.close();
  return { ms, profile };
}

const samples = Number(countArg ?? 15);
const profiles = [];
const commits = [];
for (let i = 0; i < samples + 2; i += 1) {
  const { ms, profile } = await hydrateOnce(key, i >= 2);
  if (i >= 2) {
    commits.push(ms);
    profiles.push(profile);
  }
}
console.log(
  `${key}: hydrate ${median(commits).toFixed(2)} ms to the commit (median of ${samples})`,
);
console.log('\nCPU self time per page:');
console.log(selfTime(profiles, samples).join('\n'));
if (hasFloor) {
  const port = [];
  const floor = [];
  for (let i = 0; i < samples + 2; i += 1) {
    const a = await hydrateOnce(key, false);
    const b = await hydrateOnce(floorKey, false);
    if (i >= 2) {
      port.push(a.ms);
      floor.push(b.ms);
    }
  }
  console.log(
    `\nhydrate vs floor: ${median(port).toFixed(2)} / ${median(floor).toFixed(2)} ms = ${(median(port) / median(floor)).toFixed(2)}x`,
  );
}
await browser.close();
httpServer.close();
