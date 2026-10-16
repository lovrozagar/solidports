// The regression rule for `--compare` (plan 3, leaf 1.6): baseline and working samples of one
// metric, taken in the same interleaved session, regress when the shift of the medians exceeds the
// summed p90 spread of both sides, and never by less than an absolute floor (`performance.now` is
// coarsened to 100 µs without cross-origin isolation, so near-zero steps would flag on one quantum).

/** Below this many samples on either side, p90 is the maximum and the rule decides nothing. */
export const MIN_SAMPLES = 10;

/** The upper middle sample, as the runners report it. @param {number[]} values */
export const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** The 90th-percentile sample. @param {number[]} values */
export const p90 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
};

/**
 * Metrics the rule decides on. Paint (frame-aligned) and layout/style (noise at these sizes) are
 * reported only. The base-vs-cur rule reads Solid's sync hydration time (saved baselines hold it);
 * the exit bar reads hydration to the commit, which React reaches after `hydrateRoot` returns. Heap is read only where both sides exceed 100 KB (GC noise).
 * @type {Record<string, { floor: number, minBoth?: number }>}
 */
export const GATED = {
  sync: { floor: 0.1 },
  script: { floor: 0.1 },
  settled: { floor: 0.1 },
  serverMs: { floor: 0.1 },
  hydrateSyncMs: { floor: 0.1 },
  heapKB: { floor: 0, minBoth: 100 },
};

/**
 * @param {number[]} base @param {number[]} cur
 * @param {{ floor: number, minBoth?: number }} rule
 * @returns {{ verdict: 'regressed' | 'improved' | 'same' | 'ungated' | 'insufficient', delta: number, tolerance: number, base: number, cur: number }}
 */
export function judge(base, cur, rule) {
  if (base.length === 0 || cur.length === 0) {
    throw new Error('judge: no samples on one side; a comparison needs both');
  }
  const baseMedian = median(base);
  const curMedian = median(cur);
  const spread = p90(base) - baseMedian + (p90(cur) - curMedian);
  const tolerance = Math.max(spread, rule.floor);
  const delta = curMedian - baseMedian;
  const result = { delta, tolerance, base: baseMedian, cur: curMedian };
  if (base.length < MIN_SAMPLES || cur.length < MIN_SAMPLES) {
    return { verdict: 'insufficient', ...result };
  }
  if (rule.minBoth !== undefined && (baseMedian <= rule.minBoth || curMedian <= rule.minBoth)) {
    return { verdict: 'ungated', ...result };
  }
  if (delta > tolerance) return { verdict: 'regressed', ...result };
  if (-delta > tolerance) return { verdict: 'improved', ...result };
  return { verdict: 'same', ...result };
}

/** Plan 3's exit bar: a part at most this many times its hand-written floor, and faster than React. */
export const EXIT_BAR = 1.25;

/** The SSR metrics the exit bar judges: server render and hydration to the commit. */
const EXIT_BAR_METRICS = ['serverMs', 'hydrateCommitMs'];

/**
 * Judges every SSR case that has a `<id>-floor` twin (the same case written as the Solid floor) on
 * medians: `solid` names the port's variant, `react` the first. Each verdict carries the three
 * ratios a report shows: port vs floor, port vs React, floor vs React.
 * @param {Record<string, Record<string, Record<string, number>>>} results `run.mjs` results by key
 * @param {string} solid
 */
export function exitBar(results, solid) {
  const verdicts = [];
  for (const [key, row] of Object.entries(results)) {
    const floorRow = results[`${key}-floor`];
    if (!floorRow) continue;
    for (const metric of EXIT_BAR_METRICS) {
      const port = row[solid]?.[metric];
      const floor = floorRow[solid]?.[metric];
      const react = row.react?.[metric];
      if (port == null || floor == null || react == null) continue;
      verdicts.push({
        key,
        metric,
        port,
        floor,
        react,
        portVsFloor: port / floor,
        portVsReact: port / react,
        floorVsReact: floor / react,
        pass: port <= floor * EXIT_BAR && port < react,
      });
    }
  }
  return verdicts;
}
