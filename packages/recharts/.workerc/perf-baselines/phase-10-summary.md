# Phase 10 — perf round 2

Solid 2 rc.13 port vs recharts 3.10.1 (React), prod builds, same machine. Baseline `phase-4b` (round 1 end), final `phase-10c`.
Mount: 5 passes × 12 routes. Interact: 4× CPU throttle, 4 runs, 3 cycles of 12 warm switches, hover sweep of 61 moves.

## Headline (`compare.mjs phase-4b phase-10c`)

| metric | solid | react | ratio | phase-4b |
|---|---|---|---|---|
| mount JS sum (ms) | 972.3 | 986.1 | 0.99 | 1.04 |
| tFirstPaint sum (ms) | 2720.0 | 2793.2 | 0.97 | 0.99 |
| rAF total (ms) | 32.9 | 32.7 | 1.01 | 1.04 |
| hover line / bar / area / composed | | | 0.57 / 0.74 / 0.71 / 0.59 | 0.74 / 0.64 / 0.68 / 0.71 |
| hover scatter / pie / radar | | | 0.34 / 0.74 / 0.65 | 0.28 / 0.94 / 0.64 |
| switch paint bar / area / composed / line | | | 0.93 / 1.15 / 0.92 / 0.92 | 1.21 / 1.43 / 1.13 / 1.18 |
| switch paint pie / radar / radial / scatter | | | 0.93 / 1.07 / 0.85 / 1.06 | 0.94 / 1.16 / 1.05 / 1.36 |
| switch paint funnel / sankey / treemap / sunburst | | | 0.88 / 1.01 / 1.14 / 0.91 | 0.94 / 0.96 / 1.32 / 1.13 |
| heap growth over 36 switches (MB) | 3.02 | 2.64 | 1.14 | 1.26 |

The `hover bar` gate flag (0.64 → 0.74) is noise: the unminified hover profile shows Solid 45–55 ms vs React 68–73 ms per sweep with no frame from this round's changes, and phase-10a measured 0.48.

Per-route switch paint moves ±10–20% between full runs (React alone: bar 97.8 → 81.3 → 96.2 ms). A focused run (`.tmp/grunt/perf/switch-bench.mjs`, 16 samples per route, bench predecessor) gave treemap 1.07, area 1.04, radar 1.04, scatter 1.01.

## Heap

Three-snapshot diff (`heap-diff.mjs`): no per-cycle leak in either build. The Solid-only excess came from the first cycle and was a bounded pin:

- Solid's store keeps one global `raw → target` WeakMap (`storeNextLookup`), and each target links to its parent target. A long-lived object wrapped by a chart store (module constant, user constant) keeps that whole store, and through its closures the chart's owners and DOM, alive after unmount. A second chart that wraps the same object receives the first chart's proxy.
- Keys found: `allowedTooltipTypes` (9 chart modules), Treemap/Sankey/Sunburst module `options`, default axis `padding`, Scatter item `data` (component path skipped `markRawData`).
- Fixes: `createInitialChartState` copies `options` (and its tooltip type list) per chart; `SetGraphicalItem` raw-marks item data like `actions.ts`; implicit axis padding is raw. Spec: `test/state/storeLongLivedValues.spec.tsx`.
- Detached first-cycle DOM 165 → 70 nodes; the rest are Solid `template()` caches (bounded, by design). Remaining gap ≈ templates + extra JIT code.

## Switch paint

New `switch` mode in `rv-s-profile.mjs` (warm hash switch from the bench predecessor, optional `THROTTLE`, `CALLERS`, `INCL`, `SELFUNDER`).

- `CartesianAxis` `Ticks`: `finalTicks`, `axisProps`, `textAnchor`, `customTickProps`, `tickLineProps`, `tickLineCoords` were plain functions; `visibleTicksCount` re-ran `getTicks` per tick (O(n²)) and `svgPropertiesNoEvents` ran several times per tick. Memoized: area switch JS 30.4 → 21.3 ms (React 21.6).
- `CSSTransitionAnimate`: literal getter view instead of `mergeProps`.
- `usePrefersReducedMotion`: one page-level MediaQueryList; the per-instance signal and listener were dead (the hook returns a mount snapshot).
- `RectanglePath`: one filter pass instead of a `splitProps` view plus filter.
- `Treemap`: chart SVG props filtered once (was per node); per-item node props built once (the inline JSX object re-spread on every read).
- `mergeProps` and `resolveDefaultProps` key scans use `Reflect.ownKeys` (`Object.keys` on a props proxy pays a descriptor trap per key).

Tried and dropped: a Proxy-based `mergeProps` (broke Bar/tooltip/axis specs that rely on own properties) and a single-closure `defineProperty` rewrite (no measurable gain).

## Open

- Switch paint above 1.0× on area, treemap, radar, scatter, sankey in phase-10c (focused bench: 1.01–1.07).
- Heap growth 1.07–1.14× React.
- Remaining Solid-only per-switch costs: `mergeProps` per shape (per-key `defineProperty`), two forced layouts before first paint (`useElementOffset`, `useReportScale`; React runs the latter after paint), gc.
- `test/perf/bundle.size.test.ts` fails (521 KB vs 450 KB cap); pre-existing (phase-9 recorded 520 KB).
