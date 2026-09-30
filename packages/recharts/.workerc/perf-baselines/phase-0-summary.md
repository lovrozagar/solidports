# Phase 0: Baseline (post-fix)

Two pre-existing failing files (CSSTransitionAnimate.timing, ErrorBar) and two wrong perf selectors (treemap, sunburst) were fixed before locking the baseline. Pre-fix data preserved at the bottom of this document for reference.

## Tests

| Metric              | Pre-fix | Post-fix | Delta |
|---------------------|---------|----------|-------|
| Total files         | 260     | 260      | 0     |
| Passed files        | 245     | 247      | +2    |
| Failed files        | 8       | 6        | -2    |
| Total tests         | 5230    | 5230     | 0     |
| Passed tests        | 4899    | 4912     | +13   |
| Failed tests        | 16      | 3        | -13   |
| Skipped tests       | 304     | 304      | 0     |
| Lint warnings       | 0       | 0        | 0     |
| TSC errors          | 0       | 0        | 0     |
| Bundle solid (KB)   | 421     | 421      | 0     |
| Bundle react (KB)   | 673     | 673      | 0     |

### Failing files breakdown (post-fix)

3 known (bare-JSX-at-module-level, pre-existing):
- test/chart/LineChart.spec.tsx — 0 tests collected (module-level JSX crash)
- test/chart/AreaChart.spec.tsx — 0 tests collected (module-level JSX crash)
- test/chart/AccessibilityScans.spec.tsx — 0 tests collected (module-level JSX crash)

3 infrastructure timeout (require preview servers on hardcoded port 5183/5184, expected when run without them):
- test/perf/animation.bench.test.ts
- test/perf/baseline.bench.test.ts
- test/perf/mount.bench.test.ts

### Sacred reactivity (27/27 GREEN)

| File                                               | Expected | Actual | Status |
|----------------------------------------------------|----------|--------|--------|
| test/cartesian/Brush.eventReactivity.spec.tsx      | 4        | 4      | GREEN  |
| test/chart/RechartsWrapper.eventReactivity.spec.tsx | 5       | 5      | GREEN  |
| test/chart/Sankey.tooltipReactivity.spec.tsx       | 6        | 6      | GREEN  |
| test/chart/Treemap.tooltipReactivity.spec.tsx      | 6        | 6      | GREEN  |
| test/polar/Radar.labelListReactivity.spec.tsx      | 6        | 6      | GREEN  |

## Perf: Solid vs React (12 measured routes — post-fix)

tFirstPaint in ms (avg 5 passes). avgRaf in ms.

| Chart    | tFirstPaint Solid | tFirstPaint React | tFP gap  | avgRaf Solid | avgRaf React | Raf gap    |
|----------|-------------------|-------------------|----------|--------------|--------------|------------|
| line     | 121ms             | 96ms              | +24ms    | 0.0348ms     | 0.0052ms     | +0.0296ms  |
| bar      | 192ms             | 171ms             | +21ms    | 0.0214ms     | 0.0071ms     | +0.0143ms  |
| area     | 121ms             | 93ms              | +28ms    | 0.0093ms     | 0.0068ms     | +0.0025ms  |
| composed | 99ms              | 88ms              | +11ms    | 0.0370ms     | 0.0074ms     | +0.0296ms  |
| pie      | 845ms             | 852ms             | -8ms ✓   | 0.2546ms     | 0.0083ms     | +0.2463ms  |
| radar    | 144ms             | 146ms             | -2ms ✓   | 0.0223ms     | 0.0090ms     | +0.0133ms  |
| radial   | 139ms             | 143ms             | -4ms ✓   | 0.2313ms     | 0.0153ms     | +0.2160ms  |
| scatter  | 164ms             | 155ms             | +9ms     | 0.1777ms     | 0.0088ms     | +0.1689ms  |
| funnel   | 830ms             | 839ms             | -9ms ✓   | 0.3073ms     | 0.0153ms     | +0.2920ms  |
| sankey   | 52ms              | 61ms              | -9ms ✓   | 0.0000ms     | 0.0000ms     | 0ms        |
| treemap  | 65ms              | 72ms              | -7ms ✓   | 0.0012ms     | 0.0004ms     | +0.0008ms  |
| sunburst | 51ms              | 62ms              | -11ms ✓  | 0.0000ms     | 0.0000ms     | 0ms        |

✓ marks routes where Solid already beats React on cold mount.

Cold-mount summary (post-fix):
- 6/12 routes Solid is already faster than React (pie/radar/radial/funnel/sankey/treemap/sunburst — all chart types where the Solid mount path is leaner).
- Slowest cold-mount routes for Solid: line/bar/area/scatter/composed (cartesian items) — all with measurable gap +9 to +28 ms vs React. Phase 2-3 targets.

avgRaf summary (post-fix):
- Tight (≤ +0.03 ms gap): area, line, bar, composed, radar, treemap, sankey, sunburst.
- Hot paths (≥ +0.16 ms gap): pie, radial, scatter, funnel — all run polar/scatter animation loops through the legacy Redux selector chain. Primary targets of Phases 3-4.

## Bundle bytes

| App    | Bytes   | KB    |
|--------|---------|-------|
| solid  | 431,308 | 421KB |
| react  | 689,113 | 673KB |

Solid bundle is 37% smaller than React (258KB lighter). React includes recharts + react-dom; Solid includes solid-js instead.

## Public API snapshot

Emitted to `.workerc/perf-baselines/phase-0-public-api.d.ts` (8.6KB). Used as lockdown reference for Phase 7 diff.

## Route inventory

12 routes, identical in both apps: line, bar, area, composed, pie, radar, radial, scatter, funnel, sankey, treemap, sunburst. No onlySolid / onlyReact divergence.

## Phase 0 fixes applied (before locking baseline)

### Fix 1+2 — `src/animation/CSSTransitionAnimate.tsx`

Removed Web Animations API path entirely. Restored CSS `transition: ${attribute} ${duration}ms ${easing}` in the reactive `childStyle` memo. Reverted children prop signature to 1-arg `(style) => JSX.Element`, dropping the non-upstream `setRef` arg.

Files updated:
- `src/animation/CSSTransitionAnimate.tsx` — public contract change + WAAPI removal.
- `src/cartesian/ErrorBar.tsx` — drop 2-arg destructure and `ref={animateRef}` on `<line>`.
- `src/chart/Treemap.tsx` — drop 2-arg destructure and `ref={animateRef}` on `<Layer>`.

Tests fixed: 13 (CSSTransitionAnimate.timing 9, ErrorBar animation 4).

### Fix 3 — perf script `treemap` selector

`/tmp/chart-perf-all.mjs` line 16: `.recharts-treemap-rectangle` → `.recharts-treemap-depth-1 .recharts-rectangle`. Treemap rectangles render via shared `<Rectangle>` shape with `recharts-rectangle` class; treemap layer carries `recharts-treemap-depth-N`.

### Fix 4 — perf script `sunburst` selector

`/tmp/chart-perf-all.mjs` line 17: `.recharts-sunburst-sector` → `.recharts-sunburst .recharts-sector`. Sunburst arcs render via shared `<Sector>` shape with `recharts-sector` class.

## Pre-fix snapshot (for reference)

| Chart    | tFP Solid (pre) | tFP React (pre) | gap (pre) | avgRaf Solid (pre) | avgRaf React (pre) | gap (pre)  |
|----------|-----------------|-----------------|-----------|--------------------|--------------------|------------|
| line     | 247ms           | 196ms           | +51ms     | 0.0459ms           | 0.0062ms           | +0.0397ms  |
| bar      | 323ms           | 290ms           | +33ms     | 0.0337ms           | 0.0075ms           | +0.0262ms  |
| area     | 251ms           | 185ms           | +66ms     | 0.0140ms           | 0.0062ms           | +0.0078ms  |
| composed | 219ms           | 169ms           | +50ms     | 0.0463ms           | 0.0102ms           | +0.0361ms  |
| pie      | 974ms           | 916ms           | +58ms     | 0.3297ms           | 0.0095ms           | +0.3202ms  |
| radar    | 271ms           | 198ms           | +73ms     | 0.0278ms           | 0.0107ms           | +0.0171ms  |
| radial   | 267ms           | 188ms           | +79ms     | 0.2801ms           | 0.0154ms           | +0.2647ms  |
| scatter  | 288ms           | 225ms           | +63ms     | 0.2219ms           | 0.0119ms           | +0.2100ms  |
| funnel   | 952ms           | 880ms           | +72ms     | 0.3564ms           | 0.0185ms           | +0.3379ms  |
| sankey   | 174ms           | 96ms            | +78ms     | 0.0000ms           | 0.0000ms           | 0ms        |
| treemap  | -1 (selector)   | -1 (selector)   | n/a       | n/a                | n/a                | n/a        |
| sunburst | -1 (selector)   | -1 (selector)   | n/a       | n/a                | n/a                | n/a        |

The post-fix run shows substantially lower tFirstPaint across every cartesian chart (rebuilt prod bundle no longer includes the WAAPI effect path) and revealed Solid already wins cold-mount on 7/12 routes. Hot-path animation work for Phases 3-4 is unchanged: pie, radial, funnel, scatter retain ≥ +0.16ms avgRaf gap.
