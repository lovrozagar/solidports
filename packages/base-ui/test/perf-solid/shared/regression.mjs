// The regression rule for `--compare` (plan 3, leaf 1.6; D16): baseline and working samples of
// one metric, taken in the same interleaved session. A shift is decided by a one-sided
// Mann–Whitney U test on the two sample sets (p < ALPHA), which ranks samples and so is not moved
// by the one slow outlier per side that a GC pause or the first measured run leaves, and the
// median shift's bootstrap 95% interval must lie beyond a minimum effect: an absolute floor
// (`performance.now` is coarsened to 100 µs without cross-origin isolation) or MIN_RELATIVE of the
// base median, whichever is larger. Requiring the interval, not the point estimate, to clear the
// minimum keeps a true shift of about the minimum from flagging half the time on noise. It
// replaces the summed p90 spread, which at ten samples is the maximum.

/** The one-sided significance a shift needs. */
export const ALPHA = 0.01;

/** The smallest median shift that counts, relative to the base median. */
export const MIN_RELATIVE = 0.03;

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
  // What a step retains (collected heap after it minus before it): read, as the heap after mount,
  // only where both sides retain over 100 KB. Its growth with the garbage is not judged: it moves
  // with when the engine scavenged (perf/method.md).
  retainedKB: { floor: 0, minBoth: 100 },
  // A first-open step's retention with the mount's heap (`firstOpen`): one budget, judged as heap is.
  openBudgetKB: { floor: 0, minBoth: 100 },
};

/** The standard normal upper tail, P(Z > z) (Abramowitz–Stegun 26.2.17, |error| < 7.5e-8). */
function upperTail(z) {
  if (z < 0) {
    return 1 - upperTail(-z);
  }
  const t = 1 / (1 + 0.2316419 * z);
  const poly =
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
}

/**
 * One-sided Mann–Whitney U p values for `cur` against `base`: `greater` that cur's values are
 * stochastically larger, `less` that they are smaller. Normal approximation with tie and
 * continuity corrections (sound from about eight samples a side). Both are 1 when every sample is
 * tied.
 * @param {number[]} base @param {number[]} cur
 */
export function mannWhitney(base, cur) {
  const n1 = base.length;
  const n2 = cur.length;
  const all = [
    ...base.map((value) => ({ value, cur: false })),
    ...cur.map((value) => ({ value, cur: true })),
  ];
  all.sort((a, b) => a.value - b.value);
  let rankSum = 0;
  let ties = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].value === all[i].value) {
      j += 1;
    }
    const rank = (i + j + 2) / 2;
    const size = j - i + 1;
    ties += size ** 3 - size;
    for (let k = i; k <= j; k += 1) {
      if (all[k].cur) {
        rankSum += rank;
      }
    }
    i = j + 1;
  }
  const n = n1 + n2;
  const u = rankSum - (n2 * (n2 + 1)) / 2;
  const mean = (n1 * n2) / 2;
  const variance = ((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1)));
  if (variance <= 0) {
    return { greater: 1, less: 1 };
  }
  const sd = Math.sqrt(variance);
  return {
    greater: upperTail((u - mean - 0.5) / sd),
    less: upperTail((mean - u - 0.5) / sd),
  };
}

/** A seeded uniform [0, 1) source (mulberry32): the bootstrap is reproducible run to run. */
/* eslint-disable no-bitwise -- mulberry32 is 32-bit integer arithmetic: its shifts and xors are the algorithm */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const BOOTSTRAP_RESAMPLES = 2000;

/**
 * The median shift's bootstrap 95% interval: both sides resampled with replacement, the shift of
 * their medians, its 2.5th and 97.5th percentiles.
 * @param {number[]} base @param {number[]} cur
 * @returns {[number, number]}
 */
export function shiftInterval(base, cur) {
  const next = seeded(base.length * 7919 + cur.length);
  const resample = (values) => values.map(() => values[Math.floor(next() * values.length)]);
  const shifts = [];
  for (let i = 0; i < BOOTSTRAP_RESAMPLES; i += 1) {
    shifts.push(median(resample(cur)) - median(resample(base)));
  }
  shifts.sort((a, b) => a - b);
  return [
    shifts[Math.floor(BOOTSTRAP_RESAMPLES * 0.025)],
    shifts[Math.floor(BOOTSTRAP_RESAMPLES * 0.975)],
  ];
}

/** The false discovery rate one run's comparisons are held to (Benjamini–Hochberg). */
export const FDR_Q = 0.05;

/**
 * A comparison's statistics before its verdict. The interval is computed on first read: a run
 * judges hundreds of pairs, and only those it reports or that pass the test need it.
 */
function compare(base, cur, rule) {
  if (base.length === 0 || cur.length === 0) {
    throw new Error('judge: no samples on one side; a comparison needs both');
  }
  const baseMedian = median(base);
  const curMedian = median(cur);
  const delta = curMedian - baseMedian;
  const tests = mannWhitney(base, cur);
  let ci;
  const result = {
    delta,
    minEffect: Math.max(rule.floor, MIN_RELATIVE * Math.abs(baseMedian)),
    p: delta >= 0 ? tests.greater : tests.less,
    get ci() {
      ci ??= shiftInterval(base, cur);
      return ci;
    },
    base: baseMedian,
    cur: curMedian,
  };
  let status = 'judged';
  if (base.length < MIN_SAMPLES || cur.length < MIN_SAMPLES) {
    status = 'insufficient';
  } else if (
    rule.minBoth !== undefined &&
    (baseMedian <= rule.minBoth || curMedian <= rule.minBoth)
  ) {
    status = 'ungated';
  }
  return { status, tests, result };
}

/** The verdict of a judged comparison whose test passed (`significant`): the margin decides. */
function decide(result, significant) {
  if (significant.greater && result.ci[0] > result.minEffect) {
    return 'regressed';
  }
  if (significant.less && -result.ci[1] > result.minEffect) {
    return 'improved';
  }
  return 'same';
}

/**
 * One comparison on its own: one-sided Mann–Whitney at `ALPHA`, then the margin.
 * @param {number[]} base @param {number[]} cur
 * @param {{ floor: number, minBoth?: number }} rule
 * @returns {{ verdict: 'regressed' | 'improved' | 'same' | 'ungated' | 'insufficient', delta: number, minEffect: number, p: number, ci: [number, number], base: number, cur: number }}
 */
export function judge(base, cur, rule) {
  const { status, tests, result } = compare(base, cur, rule);
  const verdict =
    status === 'judged'
      ? decide(result, { greater: tests.greater < ALPHA, less: tests.less < ALPHA })
      : status;
  return Object.assign(result, { verdict });
}

/**
 * Every comparison of one run, held together to a false discovery rate of `q`: the two-sided
 * Mann–Whitney p values of the judged pairs go through Benjamini–Hochberg, and a pair at or below
 * the resulting threshold is then decided by the margin, in the direction its median moved.
 * Insufficient and ungated pairs are not counted.
 * @template {{ base: number[], cur: number[], rule: { floor: number, minBoth?: number } }} T
 * @param {T[]} items
 * @returns {{ verdicts: (Omit<T, 'base' | 'cur' | 'rule'> & ReturnType<typeof judge>)[], pairs: number, threshold: number }}
 */
export function judgeAll(items, q = FDR_Q) {
  const compared = items.map((item) => {
    const c = compare(item.base, item.cur, item.rule);
    return { ...c, twoSided: Math.min(1, 2 * Math.min(c.tests.greater, c.tests.less)) };
  });
  const judged = compared.filter((c) => c.status === 'judged');
  const sorted = judged.map((c) => c.twoSided).sort((a, b) => a - b);
  let threshold = 0;
  for (let k = sorted.length; k >= 1; k -= 1) {
    if (sorted[k - 1] <= (q * k) / sorted.length) {
      threshold = sorted[k - 1];
      break;
    }
  }
  const verdicts = items.map(({ base: _base, cur: _cur, rule: _rule, ...rest }, index) => {
    const c = compared[index];
    let verdict = c.status;
    if (c.status === 'judged') {
      const passes = judged.length > 0 && threshold > 0 && c.twoSided <= threshold;
      verdict = decide(c.result, {
        greater: passes && c.result.delta > 0,
        less: passes && c.result.delta < 0,
      });
    }
    return Object.assign(c.result, rest, { verdict });
  });
  return { verdicts, pairs: judged.length, threshold };
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
    if (!floorRow) {
      continue;
    }
    for (const metric of EXIT_BAR_METRICS) {
      const port = row[solid]?.[metric];
      const floor = floorRow[solid]?.[metric];
      const react = row.react?.[metric];
      if (port == null || floor == null || react == null) {
        continue;
      }
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
