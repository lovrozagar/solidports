#!/usr/bin/env node
// Reads a bench report's `## Failures` section (`bench-component.mjs`'s markdown or its log) and
// decides whether a push may carry it. Only a timing regression can be carried, and only when
// `test/perf-solid/timing-allowlist.json` names its row and metric; anything else refuses: a
// hydrated-DOM mismatch, a step error, an SSR or browser exit, a heap regression, a missing row. An
// allowlist entry whose row no longer regresses has expired and refuses too, so the exemption
// cannot outlive its fix: remove the entry. Plan 3's exit bar (`exit bar: …`, a port's time
// against its hand-written floor) is reported and carried: D32 suspends it until the sweep ends. A
// 2026-10-25 compare exited 1 with a hydrated-DOM mismatch read as two timing rows, and the push
// turned main's CI red.
//
// node scripts/bench-failures.mjs <report.md|log> [allowlist.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Plan 3's exit bar (`exit bar: …`) is suspended during the sweep (D32): its entries are reported
 * and carried. Lifting D32 flips this to false, and they refuse.
 */
export const EXIT_BAR_SUSPENDED = true;

/** The bench's timing metrics: a regression in one of these is a timing row. */
export const TIMING_METRICS = new Set([
  'sync',
  'script',
  'paint',
  'settled',
  'layout',
  'style',
  'serverMs',
  'hydrateSyncMs',
  'hydrateScriptMs',
  'ttiMs',
  'inpMs',
  'commitMs',
  'settleMs',
]);

/** The `- …` entries of the last `## Failures` section in `text` (none when it has none). */
export function failureEntries(text) {
  const lines = text.split('\n');
  const start = lines.findLastIndex((line) => line.trim() === '## Failures');
  if (start < 0) {
    return [];
  }
  const entries = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6} /.test(line) || /^written /.test(line)) {
      break;
    }
    if (line.startsWith('- ')) {
      entries.push(line.slice(2).trim());
    }
  }
  return entries;
}

const REGRESSED = /^regressed: (.+) (\S+) ([\d.-]+) → ([\d.-]+) \(/;

/**
 * The verdict the report's compare table gave each row and metric it measured (`| row | metric |
 * base | cur | shift | ci | … | verdict |`) and the upper bound of its shift's 95% CI, keyed
 * `row metric`.
 */
export function measuredVerdicts(text) {
  const verdicts = new Map();
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    // `| row | metric | base | cur | shift | ci | min | p | verdict |`: ten cells with the edges.
    if (cells.length === 11 && cells[0] === '' && cells[10] === '' && /^[a-z]/i.test(cells[2])) {
      const ci = /(-?[\d.]+) to (-?[\d.]+)/.exec(cells[6]);
      verdicts.set(`${cells[1]}\u0000${cells[2]}`, {
        verdict: cells[9],
        high: ci ? Number(ci[2]) : Number.POSITIVE_INFINITY,
        minEffect: Number(cells[7]),
      });
    }
  }
  return verdicts;
}

/** A timing row's `{ row, metric }`, or null for any other failure. */
export function timingRow(entry) {
  const match = REGRESSED.exec(entry);
  if (!match || !TIMING_METRICS.has(match[2])) {
    return null;
  }
  // The shift in hundredths, as the report prints its values.
  const shift = Math.round((Number(match[4]) - Number(match[3])) * 100) / 100;
  return { row: match[1], metric: match[2], shift };
}

/**
 * The verdict on a report's failures against an allowlist (`{ entries: [{ row, metric }] }`):
 * `refused` lists every failure a push cannot carry, `allowed` the timing rows the allowlist names,
 * `suspended` the exit-bar entries D32 carries, `expired` the allowlist entries whose row the run
 * measured, did not find regressed, and bounded within noise (the shift's CI upper bound under the
 * row's own minimum effect: conclusive), `inconclusive` the ones measured and not found regressed
 * but with a CI too wide to say so (reported, not refusing). An allowed row is capped at its entry's
 * `shift`: one that regressed further refuses. An entry for a row the run did not measure
 * is unused: a toggle-only compare says nothing about button-1000.
 */
export function judgeFailures(
  entries,
  allowlist,
  measured = new Map(),
  exitBarSuspended = EXIT_BAR_SUSPENDED,
) {
  const allowed = [];
  const refused = [];
  const suspended = [];
  const named = new Map(
    (allowlist?.entries ?? []).map((entry) => [`${entry.row}\u0000${entry.metric}`, entry]),
  );
  const used = new Set();
  for (const entry of entries) {
    if (exitBarSuspended && entry.startsWith('exit bar: ')) {
      suspended.push(entry);
      continue;
    }
    const timing = timingRow(entry);
    const key = timing && `${timing.row}\u0000${timing.metric}`;
    const allowance = key ? named.get(key) : undefined;
    if (allowance && typeof allowance.shift === 'number' && timing.shift >= allowance.shift) {
      // The allowance is a cap, the CI upper bound its creating run measured: a row that regressed
      // that far or further is a new regression.
      refused.push(`${entry} (regressed beyond its allowance of ${allowance.shift})`);
      used.add(key);
    } else if (allowance) {
      allowed.push(entry);
      used.add(key);
    } else {
      refused.push(timing ? `${entry} (not in the timing allowlist)` : entry);
    }
  }
  const expired = [];
  const inconclusive = [];
  for (const entry of allowlist?.entries ?? []) {
    const key = `${entry.row}\u0000${entry.metric}`;
    const seen = measured.get(key);
    if (used.has(key) || seen === undefined || seen.verdict === 'regressed') {
      continue;
    }
    if (seen.high < seen.minEffect) {
      expired.push(`${entry.row} ${entry.metric}: no longer regressed; remove its allowlist entry`);
    } else {
      inconclusive.push(
        `${entry.row} ${entry.metric}: not regressed, but the shift's CI reaches ${seen.high}, not under the row's minimum effect ${seen.minEffect}`,
      );
    }
  }
  return {
    allowed,
    suspended,
    refused,
    expired,
    inconclusive,
    ok: refused.length === 0 && expired.length === 0,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [report, allowlistFile] = process.argv.slice(2);
  if (!report) {
    console.error('usage: node scripts/bench-failures.mjs <report.md|log> [allowlist.json]');
    process.exit(2);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const listFile = allowlistFile ?? path.join(here, '../test/perf-solid/timing-allowlist.json');
  const allowlist = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : null;
  const text = fs.readFileSync(report, 'utf8');
  const verdict = judgeFailures(failureEntries(text), allowlist, measuredVerdicts(text));
  for (const entry of verdict.allowed) console.log(`allowed: ${entry}`);
  for (const entry of verdict.suspended) console.log(`suspended (D32): ${entry}`);
  for (const entry of verdict.refused) console.log(`refused: ${entry}`);
  for (const entry of verdict.expired) console.log(`expired: ${entry}`);
  for (const entry of verdict.inconclusive) console.log(`inconclusive: ${entry}`);
  console.log(verdict.ok ? 'bench failures: none a push cannot carry' : 'bench failures: the push is refused');
  process.exit(verdict.ok ? 0 : 1);
}
