// The benchmark's engines (`ENGINE=chromium|firefox|webkit`, plan 3 leaf 1.8). Every engine times
// a step in the page (`sync`, `paint`, `settled`). The main-thread split (`script`, `layout`,
// `style`) comes from CDP's `Performance.getMetrics`, the forced collection from CDP's
// `HeapProfiler.collectGarbage` and the heap from `performance.memory`, which only Chromium has:
// the other engines report those columns as not measured, never as zero.

const SPECS = {
  chromium: {
    name: 'chromium',
    cdp: true,
    heap: true,
    launchArgs: ['--js-flags=--expose-gc', '--enable-precise-memory-info'],
  },
  firefox: { name: 'firefox', cdp: false, heap: false, launchArgs: [] },
  webkit: { name: 'webkit', cdp: false, heap: false, launchArgs: [] },
};

const IN_PAGE = ['sync', 'paint', 'settled'];
const CDP = ['script', 'layout', 'style'];

/** The engine `ENGINE` names, Chromium by default. */
export function parseEngine(value) {
  const name = value ?? 'chromium';
  if (!(name in SPECS)) {
    throw new Error(`ENGINE=${name}: the benchmark runs on chromium, firefox or webkit.`);
  }
  return name;
}

/** What an engine can measure, and how it is launched. */
export function engineSpec(name) {
  return SPECS[parseEngine(name)];
}

/** The columns an engine measures, in the report's order. */
export function measuredColumns(spec) {
  return [...IN_PAGE, ...(spec.cdp ? CDP : []), ...(spec.heap ? ['heapKB', 'heldKB'] : [])];
}
