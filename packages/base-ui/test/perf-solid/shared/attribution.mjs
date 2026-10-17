// Main-thread attribution for the core phase's profiling pass (plan 3, leaf 4.2): CPU samples and
// sampled allocations of the production builds, credited to the shared-core candidates. A sample
// goes to its deepest frame that has a bucket: a candidate's rule, else its project file under
// `packages/solid/src`. The deepest wins, so the runtime work a frame triggers (signals, effects,
// DOM) is charged to the library code that called into it, and a component rendered inside a
// kit insert is charged to itself, not to the kit. Samples with no project frame are `runtime`.
// Collection time is reported apart and shared out by allocated bytes (`distributeGc`), since a
// CPU profile charges it to "(garbage collector)" rather than to the code that allocated.

const SRC = 'packages/base-ui/packages/solid/src/';

/**
 * The shared-core candidates of plan 3 phase 4, each with the sources (paths under `src/`, or
 * runtime packages) and function names that belong to it. Checked in order: the first that
 * matches a frame is its bucket.
 */
export const CANDIDATES = [
  {
    id: 'server-renderer',
    leaf: '4.10',
    matches: (path, name) =>
      /^(renderServerElement|takeServerMarkup|setServerAttribute|ssrElement|ssrStyle|ssrClassList|escape)$/.test(
        name,
      ) &&
      (path.startsWith('utils/native/') || path.includes('@solidjs/web')),
  },
  {
    id: 'providers',
    leaf: '4.3',
    matches: (path, name) =>
      path === 'solid-helpers.tsx' && /provideContext|Provider/.test(name)
        ? true
        : path === 'utils/native/context.ts' ||
          (/(solid-js|@solidjs\/signals)/.test(path) && /Provider|setContext/.test(name)),
  },
  {
    id: 'compat-shims',
    leaf: '4.x compat shims',
    matches: (path) => path === 'solid-1-compat.ts' || path === 'solid-helpers.tsx',
  },
  { id: 'flush', leaf: '4.x flushSync', matches: (path) => path === 'utils/flushSync.ts' },
  { id: 'store', leaf: '4.4', matches: (path) => path.startsWith('utils/store/') },
  {
    id: 'keyed-selection',
    leaf: '4.6',
    matches: (path, name) =>
      path === 'utils/createKeyedSelector.ts' ||
      (!path.includes('node_modules') && /^(isHighlighted|isSelected|isActive)$/.test(name)),
  },
  {
    id: 'transitions',
    leaf: '4.7',
    matches: (path) =>
      /^utils\/(useTransitionStatus|useOpenChangeComplete|useAnimationsFinished)\./.test(path),
  },
  { id: 'floating', leaf: '4.8', matches: (path) => path.startsWith('floating-ui-solid/') },
  {
    id: 'composite-list',
    leaf: '4.9',
    matches: (path) => path.startsWith('internals/composite/list/'),
  },
  { id: 'native-kit', leaf: '4.5', matches: (path) => path.startsWith('utils/native/') },
  {
    id: 'render-element',
    leaf: '4.x slow path',
    matches: (path) =>
      path === 'utils/useRenderElement.tsx' ||
      path === 'utils/propsView.ts' ||
      path.startsWith('merge-props/'),
  },
];

/** A library source tree outside the working tree (a baseline or a control copy), if any. */
let libraryRoot = null;

/**
 * Declares the library's source root when it is not the working tree's
 * `packages/base-ui/packages/solid/src` (a copy built through `SOLID_SRC`); `null` clears it.
 */
export function setLibraryRoot(root) {
  libraryRoot = root ? `${root.replace(/\/+$/, '')}/` : null;
}

/** A source's path under the library's `src/`, or `null` outside the library. */
const libraryPath = (source) => {
  if (libraryRoot && source.startsWith(libraryRoot)) return source.slice(libraryRoot.length);
  const index = source.indexOf(SRC);
  return index >= 0 ? source.slice(index + SRC.length) : null;
};

/**
 * A resolved frame's bucket: a candidate id, `file:<path under src>` for other library code,
 * `bench-harness` for the bench's fixtures and the hand-written floors, or `null` for runtime and
 * dependency frames.
 * @param {{ source: string, name: string }} frame
 */
export function bucketOf(frame) {
  if (/\/test\/perf-solid\/|\/packages\/solid\/test\//.test(frame.source)) return 'bench-harness';
  const path = libraryPath(frame.source);
  const key = path ?? frame.source;
  for (const candidate of CANDIDATES) {
    if (candidate.matches(key, frame.name)) return candidate.id;
  }
  return path === null ? null : `file:${path}`;
}

const SPECIAL = { '(garbage collector)': 'gcMs', '(idle)': 'idleMs', '(program)': 'programMs' };

/** Buckets whose frames keep only their own time and pass the work below them up the stack. */
const PASS_THROUGH = new Set(['bench-harness', 'flush']);

/**
 * Where a runtime source lives: its package (`@solidjs/web`, `solid-js`, …), `node` for Node's
 * internals, else the file's name (a bundle position the sourcemap did not map, say).
 */
export function packageOf(source) {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(source);
  if (match) return match[1];
  if (source.startsWith('node:')) return 'node';
  return source.split('/').pop() || 'other';
}

/**
 * CPU time per bucket from a CDP profile (`Profiler.stop`): each sample's interval
 * (`timeDeltas`, µs) goes to its deepest bucketed frame, else `runtime`.
 * @param {{ nodes: { id: number, callFrame: { url: string, functionName: string, lineNumber: number, columnNumber: number }, children?: number[] }[], samples: number[], timeDeltas: number[] }} profile
 * @param {(callFrame: object) => { source: string, name: string }} resolve
 */
export function attributeCpu(profile, resolve) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parent.set(child, node.id);
  }
  const bucketCache = new Map();
  /** The sample's bucket and the function of the frame that decided it. */
  const nodeBucket = (id) => {
    if (bucketCache.has(id)) return bucketCache.get(id);
    let found = null;
    for (let current = id; current !== undefined && found === null; current = parent.get(current)) {
      const callFrame = byId.get(current).callFrame;
      const frame = callFrame.url ? resolve(callFrame) : null;
      const bucket = frame ? bucketOf(frame) : null;
      // Pass-through frames keep only their own time, never the work below them: the bench's own
      // frames (atop every stack) and flushSync (a funnel: what it flushes belongs to its caller).
      if (bucket && (!PASS_THROUGH.has(bucket) || current === id)) {
        found = {
          bucket,
          name: frame.name || `(anonymous:${frame.source.split('/').pop()}:${frame.line ?? '?'})`,
        };
      }
    }
    bucketCache.set(id, found);
    return found;
  };
  const isCandidate = (bucket) => CANDIDATES.some((candidate) => candidate.id === bucket);
  const result = {
    ms: {},
    fns: {},
    runtime: {},
    gcMs: 0,
    idleMs: 0,
    programMs: 0,
    profilerMs: 0,
    totalMs: 0,
  };
  const profilerCache = new Map();
  /** Whether the sample is the profiler itself (Node's inspector serializing at `Profiler.stop`). */
  const isProfiler = (id) => {
    if (!profilerCache.has(id)) {
      let found = false;
      for (let current = id; current !== undefined && !found; current = parent.get(current)) {
        found = byId.get(current).callFrame.url.startsWith('node:inspector');
      }
      profilerCache.set(id, found);
    }
    return profilerCache.get(id);
  };
  profile.samples.forEach((id, index) => {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    result.totalMs += ms;
    if (isProfiler(id)) {
      result.profilerMs += ms;
      return;
    }
    const special = SPECIAL[byId.get(id).callFrame.functionName];
    if (special && !byId.get(id).callFrame.url) {
      result[special] += ms;
      return;
    }
    const decided = nodeBucket(id);
    const bucket = decided?.bucket ?? 'runtime';
    result.ms[bucket] = (result.ms[bucket] ?? 0) + ms;
    if (decided && isCandidate(bucket)) {
      // A candidate's time by function, so a unit can be scoped to what dominates inside it.
      const fns = (result.fns[bucket] ??= {});
      fns[decided.name] = (fns[decided.name] ?? 0) + ms;
    }
    if (bucket === 'runtime') {
      // Runtime time with no library frame on the stack, by the package of the running frame.
      const pkg = packageOf(resolve(byId.get(id).callFrame).source);
      result.runtime[pkg] = (result.runtime[pkg] ?? 0) + ms;
    }
  });
  return result;
}

/**
 * Allocated bytes per bucket from a sampling heap profile (`HeapProfiler.stopSampling`), by the
 * same deepest-frame rule along each node's stack.
 * @param {{ head: { callFrame: object, selfSize: number, children: object[] } }} profile
 * @param {(callFrame: object) => { source: string, name: string }} resolve
 */
export function attributeAllocations(profile, resolve) {
  const bytes = {};
  const walk = (node, inherited) => {
    const own = node.callFrame.url ? bucketOf(resolve(node.callFrame)) : null;
    const bucket = own && !PASS_THROUGH.has(own) ? own : inherited;
    if (node.selfSize) {
      const key = bucket ?? (own && PASS_THROUGH.has(own) ? own : 'runtime');
      bytes[key] = (bytes[key] ?? 0) + node.selfSize;
    }
    for (const child of node.children) walk(child, bucket);
  };
  walk(profile.head, null);
  return bytes;
}

/** `gcMs` shared out in proportion to each bucket's allocated bytes. */
export function distributeGc(gcMs, bytesByBucket) {
  const total = Object.values(bytesByBucket).reduce((sum, value) => sum + value, 0);
  if (!total) return {};
  return Object.fromEntries(
    Object.entries(bytesByBucket).map(([bucket, value]) => [bucket, (gcMs * value) / total]),
  );
}
