// node profile.mjs <lib> <scenario> [dir]  -> self-time by function for mount, heap allocation sampling
// PROFILE_COLD=<pages>: each page is fresh and profiles its first mount alone, no warm-up, as the
// bench's mount step runs it; self time summed over the pages. Keys carry the column, since a
// minified bundle is one line.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const builds = path.resolve(here, '../../../../.tmp/grunt/bench-builds');
const [lib, scenario, dir = 'dist-dev', setup = '', measured = ''] = process.argv.slice(2);
const SETUP = setup || '';
// The harness exposes the library as `window.bench.debug` (`shared/harness.ts`).
const MEASURE =
  measured || `window.bench.debug.mount('${scenario}'); window.bench.debug.unmount()`;
const server = http
  .createServer((req, res) => {
    const [l, ...rest] = req.url.split('?')[0].slice(1).split('/');
    const file = path.join(builds, l, dir, rest.join('/') || 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
const url = `http://localhost:${server.address().port}/${lib}/`;
const COLD = Number(process.env.PROFILE_COLD ?? 0);
const key = (frame) =>
  `${frame.functionName || '(anon)'}:${frame.lineNumber + 1}${COLD ? `:${frame.columnNumber + 1}` : ''}`;
const selfMs = new Map();

/** Adds a CPU profile's self time per function to `selfMs`. */
function tally(profile) {
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const k = key(byId.get(id).callFrame);
    selfMs.set(k, (selfMs.get(k) || 0) + (dt[i] || 0));
  });
}

let heap = null;
if (COLD) {
  for (let i = 0; i < COLD; i += 1) {
    const page = await browser.newPage();
    await page.goto(url);
    const cdp = await page.context().newCDPSession(page);
    if (SETUP) {
      await page.evaluate(SETUP);
    }
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
    await cdp.send('Profiler.start');
    await page.evaluate(`window.bench.debug.mount('${scenario}')`);
    tally((await cdp.send('Profiler.stop')).profile);
    await page.close();
  }
} else {
  const page = await browser.newPage();
  await page.goto(url);
  const cdp = await page.context().newCDPSession(page);
  if (SETUP) {
    await page.evaluate(SETUP);
  }
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(MEASURE);
  }
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512 });
  await cdp.send('Profiler.start');
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(MEASURE);
  }
  tally((await cdp.send('Profiler.stop')).profile);
  if (!SETUP) {
    await page.evaluate(`window.bench.debug.mount('${scenario}')`);
  }
  heap = (await cdp.send('HeapProfiler.stopSampling')).profile;
}
const total = [...selfMs.values()].reduce((a, b) => a + b, 0);
console.log(
  COLD
    ? `CPU self time top 30 (ms over ${COLD} cold first mounts):`
    : 'CPU self time top 30 (ms over 5 mount+unmount):',
  (total / 1000).toFixed(1),
);
[...selfMs]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([k, v]) => console.log((v / 1000).toFixed(2).padStart(8), k));
if (heap) {
  const alloc = new Map();
  const walk = (n) => {
    const k = key(n.callFrame);
    alloc.set(k, (alloc.get(k) || 0) + n.selfSize);
    n.children.forEach(walk);
  };
  walk(heap.head);
  console.log('\nHeap alloc (live, sampled) top 25 KB:');
  [...alloc]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([k, v]) => console.log((v / 1024).toFixed(0).padStart(8), k));
}
await browser.close();
server.close();
