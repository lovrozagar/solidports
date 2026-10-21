// React's medians for the scoped gate (D29). React's bundle changes only with an upstream version,
// so the per-commit gate runs base and cur alone and the keeps-React rule reads React's medians from
// the last daily regate. A median from another session carries that session's machine state, so it
// decides a row only when the decision does not depend on the drift: the rule must come out the
// same with React `margin` times faster and `margin` times slower than cached. For a row held below
// React that is `cur <= margin x cached`, the reviewer's guard. A row the drift could flip is
// re-measured with React in the same session. The cache keeps its session's date, commit, React
// version and power state, and a different React version or power state voids it.
import { keepsReactRule } from './allowances.mjs';
import { median } from './regression.mjs';

/** The drift a cached React median is trusted across: the initial guard, to be set from data. */
export const REACT_DRIFT_MARGIN = 0.9;

/**
 * The React median that decides `verdict`'s keeps-React rule under `allowance`.
 * @param {{ key: string, metric: string, base: number, cur: number }} verdict
 * @param {object} allowance an allowance entry (`maxDelta`, optional `nearReact`, `baseAboveReact`)
 * @param {{ session?: number, cache?: { meta: { reactVersion: string, power: string }, medians: Record<string, Record<string, number>> }, current: { reactVersion: string, power: string }, margin?: number }} sources
 * @returns {{ react: number, source: 'session' | 'cache' } | { remeasure: true }}
 */
export function resolveReact(verdict, allowance, sources) {
  if (sources.session !== undefined) {
    return { react: sources.session, source: 'session' };
  }
  const { cache, current } = sources;
  const margin = sources.margin ?? REACT_DRIFT_MARGIN;
  if (
    !cache ||
    cache.meta.reactVersion !== current.reactVersion ||
    cache.meta.power !== current.power
  ) {
    return { remeasure: true };
  }
  const cached = cache.medians[verdict.key]?.[verdict.metric];
  if (cached === undefined) {
    return { remeasure: true };
  }
  const faster = keepsReactRule(allowance, verdict, cached * margin);
  const slower = keepsReactRule(allowance, verdict, cached / margin);
  return faster === slower ? { react: cached, source: 'cache' } : { remeasure: true };
}

/**
 * The cache a full regate writes: React's median for every row and metric it measured.
 * @param {Record<string, Record<string, { samples: Record<string, number[]> }>>} summary
 * @param {{ date: string, sha: string, reactVersion: string, power: string }} meta
 */
export function reactCacheFrom(summary, meta) {
  const medians = {};
  for (const [key, row] of Object.entries(summary)) {
    for (const [metric, samples] of Object.entries(row.react?.samples ?? {})) {
      if (Array.isArray(samples) && samples.length) {
        (medians[key] ??= {})[metric] = median(samples);
      }
    }
  }
  return { meta, medians };
}
