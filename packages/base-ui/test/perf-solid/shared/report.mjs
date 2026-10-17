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

/**
 * Judges every gated metric of `cur` against `base` (1.6 rule); one verdict per key and metric.
 * Raw floor scenarios (`options.raw`, scenario ids) never use the library, so their difference is
 * session noise: they are reported, not judged.
 */
export function compareVariants(summary, base, cur, options = {}) {
  const raw = new Set(options.raw ?? []);
  const verdicts = [];
  for (const [key, entry] of Object.entries(summary)) {
    const metrics = key.endsWith(HEAP) ? ['heapKB'] : ['sync', 'script', 'settled'];
    for (const metric of metrics) {
      const a = entry[base].samples[metric];
      const b = entry[cur].samples[metric];
      if (!a?.length && !b?.length) continue;
      const judged = judge(a, b, GATED[metric]);
      const id = key.slice(0, key.indexOf(' › '));
      verdicts.push({
        key,
        metric,
        ...judged,
        ...(raw.has(id) ? { verdict: 'unjudged (raw floor)' } : {}),
      });
    }
  }
  return verdicts;
}

const fmtMs = (n) => (n == null ? '-' : n.toFixed(2));

/**
 * The SSR bench's main-thread table: CDP task, layout and style per hydration step, by fixture
 * (`results[key][variant]` medians). No lines when no variant hydrated (`SERVER_ONLY`).
 */
export function mainThreadLines(keys, results, names) {
  const hydrated = keys.some((key) =>
    names.some((name) => typeof results[key]?.[name]?.commitTaskMs === 'number'),
  );
  if (!hydrated) {
    return [];
  }
  const lines = [
    '',
    '## Main thread while hydrating',
    '',
    'CDP `TaskDuration`, `LayoutDuration` and `RecalcStyleDuration` ms and `LayoutCount` / `RecalcStyleCount`, medians: up to the commit (a layout there is forced by script), then over the two settled frames.',
    '',
    `| fixture | ${names.map((n) => `${n} to commit: task ms / layout ms / style ms / layouts / recalcs · settle: task ms / layout ms / style ms`).join(' | ')} |`,
    `|---|${names.map(() => '---').join('|')}|`,
  ];
  for (const key of keys) {
    const row = results[key];
    const cells = names.map(
      (n) =>
        `${fmtMs(row[n].commitTaskMs)} / ${fmtMs(row[n].commitLayoutMs)} / ${fmtMs(row[n].commitStyleMs)} / ${row[n].commitLayouts} / ${row[n].commitStyles} · ${fmtMs(row[n].settleTaskMs)} / ${fmtMs(row[n].settleLayoutMs)} / ${fmtMs(row[n].settleStyleMs)}`,
    );
    lines.push(`| ${key} | ${cells.join(' | ')} |`);
  }
  return lines;
}

