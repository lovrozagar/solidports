// The gate's reviewed allowances: a regression the port takes on purpose, because the row's gated
// floor requires the same cost (D23) or because the commit that causes it wins over 10x the loss in
// the same family (a trade, D24). Each names its decision entry, the reason, the largest shift it
// allows and when it lapses (`until`: the plan leaf that must remove it, or the decision that says
// when). A row is allowed only within that bound and while its median stays below React's median
// in the same session; an entry marked `baseAboveReact` (a row that was above React at the base
// already) instead needs the base above React in the same session. A shift past the bound, a row
// that fails its React rule, another metric or another row still fails. `maxDelta` is measured
// against the regate's base (3eef0aca) and is re-derived at the next regate. `bench:component
// --compare` reports allowed rows apart from its failures.
import fs from 'node:fs';

/** @type {readonly { key: string, metric: string, maxDelta: number, decision: string, until: string, reason: string, baseAboveReact?: boolean }[]} */
export const ALLOWANCES = [
  {
    key: 'toggle-group/300-single › heap after mount KB',
    metric: 'heapKB',
    // 1.25x the keyed floor's increment over the direct floor (toggle-group/raw-300: 375.0 against
    // 304.2 KB, Mac 2026-10-21): 88.5 KB.
    maxDelta: 88.5,
    decision: 'D23',
    // Plan 3 leaf 5.3, the toggle family's exit, re-measures the row against the floor.
    until: '5.3',
    reason:
      'one keyed-highlight slot per toggle (about 141 B against the keyed floor’s 236 B per key), the roving tab stop of a composite list held to the keyed floor (D20)',
  },
  // D24 trades: the bound is the largest upper end of the shift's 95% CI from 3eef0aca over the Mac
  // sessions of 2026-10-21 (chain-mac42 to macfx).
  // d4e50c03's keyed popup trigger selectors: tooltip/handle-500 hover across 50 -49.6 ms.
  ...['sync', 'script'].map((metric) => ({
    key: 'preview-card/roots-200 › move across 20',
    metric,
    maxDelta: metric === 'sync' ? 2.7 : 1.91,
    decision: 'D24',
    // Plan 3 leaf 5.7 recovers it with the diagnostics D24 records.
    until: '5.7',
    reason:
      'the keyed popup trigger selectors (d4e50c03) cost one-trigger roots native time no JS frame accounts for, and buy multi-trigger hover over 10x the loss',
  })),
  // 4657916f's keyed list highlight: menu/500 nav x50 -11.2 ms and hover sweep 100 -12.6 ms. The
  // row was above React at the base (22.1 against 11.4 ms, 1.94x).
  ...['sync', 'script'].map((metric) => ({
    key: 'menu/500 › open by keyboard',
    metric,
    maxDelta: metric === 'sync' ? 2.5 : 2.58,
    decision: 'D24',
    // Plan 3 leaf 5.6.0, the popup-open work, must bring the row back to its base or the entry fails.
    until: '5.6.0',
    baseAboveReact: true,
    reason:
      'the keyed list highlight (4657916f) costs Menu’s keyboard open time no JS frame accounts for, and buys navigation and hover over 10x the loss',
  })),
];

const DECISION_LOG = new URL('../../../context/decisions/log.md', import.meta.url);

/**
 * The problems with a list of allowances, empty when every entry is complete: a reason, a positive
 * bound, a decision the log holds, and an expiry naming a plan leaf or a decision.
 * @param {readonly (typeof ALLOWANCES)[number][]} allowances
 * @returns {string[]}
 */
export function validateAllowances(allowances) {
  const log = fs.readFileSync(DECISION_LOG, 'utf8');
  const problems = [];
  for (const entry of allowances) {
    const name = `${entry.key} ${entry.metric}`;
    if (!(typeof entry.reason === 'string' && entry.reason.length > 20)) {
      problems.push(`${name}: the reason must say why the floor requires the cost`);
    }
    if (!(entry.maxDelta > 0)) {
      problems.push(`${name}: maxDelta must be a positive bound`);
    }
    if (!/^D\d+$/.test(entry.decision) || !log.includes(`### ${entry.decision} — `)) {
      problems.push(`${name}: decision ${entry.decision} is not in the decision log`);
    }
    if (typeof entry.until !== 'string' || !/^(?:\d+(?:\.\d+)+|D\d+)$/.test(entry.until)) {
      problems.push(`${name}: \`until\` must name a plan leaf (5.3) or a decision (D23)`);
    }
  }
  return problems;
}

/**
 * Splits regressed verdicts into the allowed ones (an allowance for their row and metric, the shift
 * within its bound, and its React rule held in the same session) and the failing rest.
 * @template {{ key: string, metric: string, delta: number, base: number, cur: number }} V
 * @param {readonly V[]} regressions
 * @param {(verdict: V) => number | undefined} reactMedian React's median for the verdict's row and
 *   metric in this session; a row React did not measure is never allowed.
 * @returns {{ allowed: (V & { allowance: (typeof ALLOWANCES)[number], react: number })[], failing: V[] }}
 */
export function splitAllowed(regressions, reactMedian) {
  const allowed = [];
  const failing = [];
  for (const verdict of regressions) {
    const allowance = ALLOWANCES.find(
      (entry) => entry.key === verdict.key && entry.metric === verdict.metric,
    );
    const react = allowance === undefined ? undefined : reactMedian(verdict);
    // A row above React at the base keeps its ratio to React within base/react + maxDelta/react,
    // that is, its own base plus the bound; any other row stays below React.
    const reactRule =
      react !== undefined &&
      (allowance?.baseAboveReact && verdict.base > react
        ? verdict.cur - verdict.base <= allowance.maxDelta
        : verdict.cur < react);
    if (allowance !== undefined && verdict.delta <= allowance.maxDelta && reactRule) {
      allowed.push({ ...verdict, allowance, react });
    } else {
      failing.push(verdict);
    }
  }
  return { allowed, failing };
}
