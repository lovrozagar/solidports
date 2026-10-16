// Turns raw bench samples into the report summary and judges a baseline/working pair of variants.
// `run.mjs` writes the summary; `scripts/bench-component.mjs` reads it for `--compare`.
import { GATED, judge, median, p90 } from './regression.mjs';

const HEAP = 'heap after mount KB';

/**
 * @param {Record<string, Record<string, { steps: Record<string, Record<string, number[]>>, heapKB: number[] }>>} results
 *   results[scenario][variant]: per-step samples (sync, paint, script, layout, style, settled) and heapKB.
 * @param {string[]} names variant names; ratios are taken against the first.
 * @param {Record<string, Record<string, number>>} timers timers[scenario][step]: the declared `timerMs`.
 */
export function summarize(results, names, timers) {
  const summary = {};
  for (const [id, byName] of Object.entries(results)) {
    for (const step of Object.keys(byName[names[0]].steps)) {
      const timer = timers[id]?.[step];
      const entry = { ratios: {} };
      for (const name of names) {
        const s = byName[name].steps[step];
        const settled = timer === undefined ? [] : (s.settled ?? []).map((value) => value - timer);
        entry[name] = {
          sync: median(s.sync),
          syncP90: p90(s.sync),
          paint: median(s.paint),
          script: median(s.script),
          layout: median(s.layout),
          style: median(s.style),
          settled: settled.length ? median(settled) : null,
          samples: { sync: s.sync, script: s.script, settled },
        };
      }
      for (const name of names.slice(1)) {
        entry.ratios[`${name}/${names[0]}`] = {
          sync: entry[name].sync / entry[names[0]].sync,
          script: entry[name].script / Math.max(entry[names[0]].script, 0.01),
        };
      }
      summary[`${id} › ${step}`] = entry;
    }
    const heap = {};
    for (const name of names) {
      heap[name] = {
        heapKB: median(byName[name].heapKB),
        samples: { heapKB: byName[name].heapKB },
      };
    }
    summary[`${id} › ${HEAP}`] = heap;
  }
  return summary;
}

/** Judges every gated metric of `cur` against `base` (1.6 rule); one verdict per key and metric. */
export function compareVariants(summary, base, cur) {
  const verdicts = [];
  for (const [key, entry] of Object.entries(summary)) {
    const metrics = key.endsWith(HEAP) ? ['heapKB'] : ['sync', 'script', 'settled'];
    for (const metric of metrics) {
      const a = entry[base].samples[metric];
      const b = entry[cur].samples[metric];
      if (!a?.length && !b?.length) continue;
      verdicts.push({ key, metric, ...judge(a, b, GATED[metric]) });
    }
  }
  return verdicts;
}
