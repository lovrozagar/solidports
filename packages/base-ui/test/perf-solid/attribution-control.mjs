// Positive controls for the profiling pass (`attribution.mjs`): known work injected into one
// candidate of a copy of the library must come out credited to that candidate, through the real
// builds, profiles and sourcemaps.
//   cpu: an allocation-free busy loop at the top of the native kit's `renderClientElement`; on
//        collapsible/300's mount, the time added to `native-kit` must be within ±25% of the added
//        busy time (leaving out what the allocation control adds: its bucket and the GC).
//   alloc: a 16 KB array per native context owner (`createContextOwner`), counted as it runs; on
//        the same mount, the bytes added to `providers` must be within ±10% of the injected bytes
//        (calls × the array's size), and its GC share must grow.
// Usage (from packages/base-ui): node test/perf-solid/attribution-control.mjs [runs=4]
// Exit 1 when a control fails.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUi = path.resolve(here, '../..');
const repo = path.resolve(baseUi, '../..');
const work = path.join(repo, '.tmp/grunt/attribution-control');
const RUNS = process.argv[2] ?? '4';
/** The fixed bars: CPU within ±25% of the added time, allocation within ±10% of the bytes. */
const CPU_TOLERANCE = 0.25;
const BYTES_TOLERANCE = 0.1;
/**
 * One injected array in Chromium: 4096 small integers at 4 bytes each (V8 compresses pointers on
 * 64-bit Chromium), plus its backing store's and the array's headers (16 bytes each).
 */
const INJECTED_BYTES = 4096 * 4 + 32;
const PROBE = '__attributionAllocs';

/** The injections, each into a source file of the copy: an anchor and the code put after it. */
const INJECTIONS = [
  {
    file: 'utils/native/element.ts',
    anchor:
      '  // The body runs untracked (`createComponent`): reads here subscribe to nothing.\n  const owner = getOwner();\n',
    // Integer work only: a `performance.now()` loop would box a number per turn and allocate.
    code: '  {\n    let spin = 0;\n    for (let i = 0; i < 200000; i += 1) spin = (spin + i) | 0;\n    (globalThis as Record<string, unknown>).__attributionSpin = spin;\n  }\n',
  },
  {
    file: 'utils/native/context.ts',
    anchor: '  const owner = createOwner(TRANSPARENT);\n',
    code: '  (globalThis as Record<string, unknown>).__attributionSink = new Array(4096).fill(0);\n  (globalThis as Record<string, number>).__attributionAllocs =\n    ((globalThis as Record<string, number>).__attributionAllocs ?? 0) + 1;\n',
  },
];

function attribution(src, out, results) {
  const run = spawnSync('node', ['test/perf-solid/attribution.mjs', RUNS, 'collapsible/300'], {
    cwd: baseUi,
    env: {
      ...process.env,
      ATTRIBUTION_SRC: src,
      ATTRIBUTION_OUT: out,
      RESULTS_FILE: results,
      BROWSER_ONLY: '1',
      ATTRIBUTION_PROBE: PROBE,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (run.status !== 0) {
    throw new Error(`attribution.mjs (${out}) exited ${run.status}`);
  }
  return JSON.parse(fs.readFileSync(`${results}.json`, 'utf8')).results.browser;
}

fs.rmSync(work, { recursive: true, force: true });
const controlSrc = path.join(work, 'src');
fs.cpSync(path.join(baseUi, 'packages/solid/src'), controlSrc, { recursive: true });
for (const injection of INJECTIONS) {
  const file = path.join(controlSrc, injection.file);
  const text = fs.readFileSync(file, 'utf8');
  if (text.split(injection.anchor).length !== 2) {
    throw new Error(`control anchor not found once in ${injection.file}`);
  }
  fs.writeFileSync(
    file,
    text.replace(injection.anchor, injection.replace ?? `${injection.anchor}${injection.code}`),
  );
}

const base = attribution(
  path.join(baseUi, 'packages/solid/src'),
  'attribution-control-base',
  path.join(work, 'base'),
);
const control = attribution(controlSrc, 'attribution-control', path.join(work, 'control'));

const sum = (values) => Object.values(values).reduce((a, b) => a + b, 0);
const delta = (a = {}, b = {}) =>
  Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)]),
  );
const failures = [];

// Both on collapsible/300's mount.
const before = base['collapsible/300'].steps.mount;
const after = control['collapsible/300'].steps.mount;
const ms = delta(before.ms, after.ms);
const bytes = delta(before.bytes, after.bytes);
const gcShare = delta(before.gcShare, after.gcShare);
{
  // The added time the allocation control does not explain (its own bucket and the collection).
  const busy = after.totalMs - before.totalMs - (ms.providers ?? 0) - (after.gcMs - before.gcMs);
  const kit = ms['native-kit'] ?? 0;
  console.log(
    `cpu: added busy ${busy.toFixed(1)} ms outside the allocation control, native-kit +${kit.toFixed(1)} ms (${((100 * kit) / busy).toFixed(0)}%)`,
  );
  if (!(busy > 5 && Math.abs(kit - busy) <= CPU_TOLERANCE * busy)) {
    failures.push(
      `cpu control: native-kit got ${kit.toFixed(1)} of ${busy.toFixed(1)} added ms (bar ±${CPU_TOLERANCE * 100}%)`,
    );
  }
}
{
  const added = sum(bytes);
  const providers = bytes.providers ?? 0;
  const injected = (after.probe ?? 0) * INJECTED_BYTES;
  console.log(
    `alloc: injected ${after.probe ?? 0} arrays (${(injected / 1048576).toFixed(1)} MB), added ${(added / 1048576).toFixed(1)} MB, providers +${(providers / 1048576).toFixed(1)} MB (${((100 * providers) / injected).toFixed(0)}% of injected), its GC share +${(gcShare.providers ?? 0).toFixed(1)} ms`,
  );
  if (!(injected > 1048576 && Math.abs(providers - injected) <= BYTES_TOLERANCE * injected)) {
    failures.push(
      `alloc control: providers got ${providers} of ${injected} injected bytes (bar ±${BYTES_TOLERANCE * 100}%)`,
    );
  }
  if (!((gcShare.providers ?? 0) > 0)) {
    failures.push('alloc control: the providers GC share did not grow');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('controls pass');
