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

/** @type {readonly { key: string, metric: string, maxDelta: number, decision: string, until: string, reason: string, baseAboveReact?: boolean, class?: 'residual', evidence?: { calls: string, experiments: readonly string[] } }[]} */
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
  // D25, the D23 rule: heap the keyed floor requires per key (236 B, toggle-group/raw-300), the bound
  // 1.25x the floor's increment for the row's keys, the row below React (scoped5, 2026-10-21).
  {
    key: 'toggle-group/300-multiple › heap after mount KB',
    metric: 'heapKB',
    // 300 toggles, as toggle-group/300-single: 88.5 KB. Measured +79.4 (265 B a toggle: the keyed
    // highlight slot and the keyed pressed leaf, ccb8432d); React 1,895 KB.
    maxDelta: 88.5,
    decision: 'D25',
    until: '5.3',
    reason:
      'one keyed-highlight slot and one keyed pressed leaf per toggle (265 B), the roving tab stop held to the keyed floor (D20) and the pressed state keyed (ccb8432d)',
  },
  {
    key: 'composition/direction-500 › heap after mount KB',
    metric: 'heapKB',
    // 500 toggles of one ToggleGroup: 1.25 x 236 B x 500 = 147.5 KB. Measured +142.5 (285 B a
    // toggle); React 3,379.6 KB.
    maxDelta: 147.5,
    decision: 'D25',
    until: '5.3',
    reason:
      'the toggle group’s per-toggle keyed highlight slot and keyed pressed leaf (285 B a toggle) at 500 toggles, held to the keyed floor (D20)',
  },
  {
    key: 'combobox/full-1000 › replace items while open',
    metric: 'retainedKB',
    // 1,000 new items: 1.25 x 236 B x 1,000 = 295 KB. Measured +73.8 (74 B an item, e726bd36);
    // React retains 3,953.7 KB.
    maxDelta: 295,
    decision: 'D25',
    until: '5.6.0',
    reason:
      'the keyed highlight’s slots for the new items a replace mounts (74 B an item against the keyed floor’s 236 B per key, e726bd36)',
  },
  // D25, the D24 rule: a trade with the same family's wins from the same commit, over 10x the loss;
  // the bound the largest upper end of the shift's 95% CI from 3eef0aca (regate4, macfine, scoped5).
  // e726bd36's toolbar/200: ArrowRight x100 -22.1 ms against +1.34 ms (open, close, unmount), 16x.
  ...[
    ['sync', 0.2],
    ['script', 1.02],
  ].map(([metric, maxDelta]) => ({
    key: 'toolbar/200 › open menu via toolbar button',
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.3',
    baseAboveReact: true,
    reason:
      'the keyed composite highlight (e726bd36) costs a toolbar’s menu open no JS frame accounts for, and buys toolbar ArrowRight x100 -22.1 ms, 16x the loss',
  })),
  // e726bd36 and ccb8432d's toggle-group/300-multiple: click 100 -13.8 ms and ArrowRight x50 -13.1
  // ms; the controlled value is below React (0.8 against 2.0 ms).
  ...[
    ['sync', 0.6],
    ['script', 0.57],
  ].map(([metric, maxDelta]) => ({
    key: 'toggle-group/300-multiple › controlled value',
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.3',
    reason:
      'the keyed highlight and keyed pressed membership (e726bd36, ccb8432d) cost a controlled multiple value’s update, and buy click 100 and ArrowRight x50 over 10x the loss',
  })),
  // e726bd36 and ccb8432d's toggle-group/300: the same family's click 100 (-14.7, -13.8 ms) and
  // ArrowRight x50 (-11.7, -13.1 ms); unmount was above React at the base (0.5 against 0.4 ms).
  ...[
    ['toggle-group/300-single › unmount', 'sync', 0.2],
    ['toggle-group/300-single › unmount', 'script', 0.2],
    ['toggle-group/300-multiple › unmount', 'sync', 0.2],
    ['toggle-group/300-multiple › unmount', 'script', 0.18],
  ].map(([key, metric, maxDelta]) => ({
    key,
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.3',
    baseAboveReact: true,
    reason:
      'one cleanup per keyed read (the keyed highlight slot and the keyed pressed leaf), the keyed floor’s own unmount cost, against the family’s click 100 and ArrowRight x50 wins',
  })),
  // e726bd36's composition/direction-500: ArrowLeft x20 (rtl) -15.0 ms against unmount +0.3, 50x;
  // the base equal to React (sync 0.70 against 0.70; script 0.78 against 0.71). Sync's bound is the
  // keyed floor's own unmount increment at 500 keys, 1.25 x 0.3 ms; script's the CI's upper end.
  ...[
    ['sync', 0.375],
    ['script', 0.31],
  ].map(([metric, maxDelta]) => ({
    key: 'composition/direction-500 › unmount',
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.3',
    baseAboveReact: true,
    reason:
      'one cleanup per keyed read at 500 toggles, the keyed floor’s own unmount cost, against the family’s ArrowLeft x20 -15.0 ms, 50x',
  })),
  // d4e50c03's tooltip/handle-500: hover across 50 -49.6 ms; unmount below React (3.8 against 32.9).
  ...[
    ['sync', 0.3],
    ['script', 0.34],
  ].map(([metric, maxDelta]) => ({
    key: 'tooltip/handle-500 › unmount',
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.7',
    reason:
      'the keyed popup trigger selectors (d4e50c03) cost a detached-trigger unmount and buy hover across 50 -49.6 ms',
  })),
  // D25's residual class: no mechanism after named experiments, equal calls, at most 0.5 ms.
  ...[
    ['context-menu/200 › right-click open', 'sync', 0.4, true],
    ['context-menu/200 › right-click open', 'script', 0.45, true],
    ['context-menu/200 › select item', 'script', 0.18, false],
    ['context-menu/200 › reopen + escape', 'script', 0.36, false],
  ].map(([key, metric, maxDelta, baseAboveReact]) => ({
    key,
    metric,
    maxDelta,
    decision: 'D25',
    until: '5.6',
    ...(baseAboveReact ? { baseAboveReact: true } : {}),
    class: 'residual',
    evidence: {
      calls: 'maccnt4 (2026-10-21): right-click open 66,186 calls at the tip against 65,764 at a04e4dfb',
      experiments: [
        'pcmemo2: provideContext children memo, no time change (macpcm2)',
        'ctxjsx: ContextMenuRoot JSX providers restored, no time change (macfour)',
      ],
    },
    reason:
      'context-menu/200 since b75c8bd5: equal calls, and restoring the provider shape recovers nothing; no mechanism found',
  })),
];

const DECISION_LOG = new URL('../../../context/decisions/log.md', import.meta.url);

/**
 * Floating-point slack for a shift at its bound: medians come at 0.1 ms resolution, and 0.8 - 0.23
 * is 0.5700000000000001 (regate6 failed two rows exactly at their bounds). Far below any metric's
 * resolution, so it widens no bound.
 */
const BOUND_SLACK = 1e-6;

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
    // D25: a residual without mechanism names its equal call counts and an experiment that
    // recovered nothing, and allows at most 0.5 ms.
    if (entry.class === 'residual') {
      if (!(typeof entry.evidence?.calls === 'string' && entry.evidence.calls.length > 0)) {
        problems.push(`${name}: a residual names the equal call counts (evidence.calls)`);
      }
      if (!(entry.evidence?.experiments?.length > 0)) {
        problems.push(
          `${name}: a residual names an experiment that recovered nothing (evidence.experiments)`,
        );
      }
      if (entry.maxDelta > 0.5) {
        problems.push(`${name}: a residual allows at most 0.5 ms`);
      }
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
    // A row not winning at the base (above React, or equal to it: D25, parity is not winning) keeps
    // its ratio to React within base/react + maxDelta/react, that is, its own base plus the bound;
    // any other row stays below React.
    const reactRule =
      react !== undefined &&
      (allowance?.baseAboveReact && verdict.base >= react
        ? verdict.cur - verdict.base <= allowance.maxDelta + BOUND_SLACK
        : verdict.cur < react);
    if (
      allowance !== undefined &&
      verdict.delta <= allowance.maxDelta + BOUND_SLACK &&
      reactRule
    ) {
      allowed.push({ ...verdict, allowance, react });
    } else {
      failing.push(verdict);
    }
  }
  return { allowed, failing };
}
