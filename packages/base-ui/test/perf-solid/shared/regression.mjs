// The regression rule for `--compare` (plan 3, leaf 1.6): baseline and working samples of one
// metric, taken in the same interleaved session, regress when the shift of the medians exceeds the
// summed p90 spread of both sides, and never by less than an absolute floor (`performance.now` is
// coarsened to 100 µs without cross-origin isolation, so near-zero steps would flag on one quantum).

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
 * reported only. Heap is read only where both sides exceed 100 KB (GC noise below that).
 * @type {Record<string, { floor: number, minBoth?: number }>}
 */
export const GATED = {
  sync: { floor: 0.1 },
  script: { floor: 0.1 },
  settled: { floor: 0.1 },
  serverMs: { floor: 0.1 },
  heapKB: { floor: 0, minBoth: 100 },
};

/**
 * @param {number[]} base @param {number[]} cur
 * @param {{ floor: number, minBoth?: number }} rule
 * @returns {{ verdict: 'regressed' | 'improved' | 'same' | 'ungated', delta: number, tolerance: number, base: number, cur: number }}
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
  if (rule.minBoth !== undefined && (baseMedian <= rule.minBoth || curMedian <= rule.minBoth)) {
    return { verdict: 'ungated', ...result };
  }
  if (delta > tolerance) return { verdict: 'regressed', ...result };
  if (-delta > tolerance) return { verdict: 'improved', ...result };
  return { verdict: 'same', ...result };
}
