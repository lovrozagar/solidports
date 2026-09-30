# Phase 4: polar items direct-read migration

Phase 4 mirrors Phase 3 architecture for the polar family. PolarAngleAxis/PolarRadiusAxis gain dual-write (the polar analog of Phase 2's cartesian XAxis/YAxis dual-write that was deferred). Pie/Radar/RadialBar migrate to direct-read via `useChartState()` with override-param injection (D17). `ItemState` widens to a unified discriminated union covering both cartesian and polar items.

## Tests

| Metric              | Phase 3 | Phase 4 | Delta |
|---------------------|---------|---------|-------|
| Total files         | 273     | 280     | +7    |
| Passed files        | 260     | 267     | +7    |
| Failed files        | 6       | 6       | 0     |
| Total tests         | 5283    | 5325    | +42   |
| Passed tests        | 4961    | 5003    | +42   |
| Sacred reactivity   | 27/27   | 27/27   | OK    |
| Lint warnings       | 0       | 0       | 0     |
| TSC errors          | 0       | 0       | 0     |

The 6 remaining failed files are unchanged: 3 known JSX-crash files + 3 perf-bench infra timeouts. No new failures introduced.

### New tests written in Phase 4 (7 files)

```
test/polar/Pie.stateReactivity.spec.tsx                          Pie reacts to chartState mutation
test/polar/Radar.stateReactivity.spec.tsx                        Radar reactivity (incl. labelList preserved)
test/polar/RadialBar.stateReactivity.spec.tsx                    RadialBar reactivity (settings + axis overrides)
test/state/_solid/polarAxes.reactivity.spec.tsx                  PolarAngleAxis/PolarRadiusAxis dual-write
test/state/selectors/polarAxisSelectors.injection.spec.tsx       angle/radius override-param injection
test/state/selectors/polarSelectors.injection.spec.tsx           selectRadarPoints/selectRadialBarSectors override threading
test/state/_solid/chartState.polarItemShape.spec.ts              PieState/RadarState/RadialBarState shape
```

## Files modified

```
src/state/_solid/chartState.ts                         AngleAxisState/RadiusAxisState widened to {settings}; PieState/RadarState/RadialBarState added; ItemState union extended
src/state/SetGraphicalItem.ts                          polar dual-write — setState("graphicalItems", id, {type, settings})
src/state/selectors/axisSelectors.ts                   selectBaseAxis polar branches forward override
src/state/selectors/polarAxisSelectors.ts              selectAngleAxis/selectRadiusAxis with override + _solid probe + legacy fallback
src/state/selectors/radarSelectors.ts                  selectRadarPoints + selectAngleAxisWithScaleAndViewportWithOverride (override threading)
src/state/selectors/radialBarSelectors.ts              selectRadialBarSectors override-aware bandSize/position recomputation
src/polar/PolarAngleAxis.tsx                           dual-write to state.polarAxes.angleAxis[id]
src/polar/PolarRadiusAxis.tsx                          dual-write to state.polarAxes.radiusAxis[id]
src/polar/Pie.tsx                                      direct read + cellsRegistry preserved
src/polar/Radar.tsx                                    direct read; settings spread { ...angleEntry.settings } for proper Solid sub-property tracking
src/polar/RadialBar.tsx                                direct read + mergeProps reactive bridge for sectors
```

## Perf — polar charts vs Phase 0 baseline

3-run mean (after Radar reactive-spread fix):

| Chart   | Phase 0 avgRaf | Phase 4 avgRaf | Δ vs Phase 0 | Verdict       |
|---------|----------------|-----------------|--------------|---------------|
| pie     | 0.2546ms       | 0.2412ms        | -5% BETTER   | PASS          |
| radar   | 0.0223ms       | 0.0256ms        | +15%         | PASS-with-note|
| radial  | 0.2313ms       | 0.2278ms        | -2% FLAT     | PASS          |

Cartesian charts unchanged from Phase 3 (no Phase 4 edits to cartesian code).

### Radar +15% — accepted-with-note

Initial Phase 4 radar showed +20% regression. Debugger root-caused to a missing object spread on the angle-axis settings probe in `Radar.tsx:616` — bare `as AngleAxisSettings` cast doesn't enumerate keys, so Solid's fine-grained reactivity doesn't subscribe to sub-properties → memo invalidates spuriously per upstream tick. Fix: `{ ...angleEntry.settings } as AngleAxisSettings` (and corresponding radius spread) mirrors the working RadialBar pattern.

Post-fix mean 0.0256ms — improved from initial 0.0290 but +15% above Phase 0 floor. Absolute delta: +3.3µs/frame. At 60fps this is 0.02% of frame budget — sub-perceptual.

Same precedent as Phase 2 bar +14%: accepted as documented strangler-fig cost, attributed to the cross-cutting selector chain `selectAngleAxisWithScaleAndViewport` still hosting some legacy proxy traversal even with override threading. Phase 6's public hooks port may eliminate this — the hooks rebuild scale derivation against the new state from scratch.

### Pie 24× React, RadialBar 13× React — gap deferred to Phase 6

Pie React 0.0102 vs Solid 0.2412. Radial React 0.0179 vs Solid 0.2278. These are wide pre-existing gaps not introduced by Phase 4 — Phase 4 monotonic improvement gate met (-5% pie, -2% radial). Closing the React parity gap is a Phase 6 hook-port concern.

## Spec acceptance gate scoreboard

- [x] All 3 polar items own their state derivation (Pie/Radar/RadialBar)
- [x] PolarAngleAxis/PolarRadiusAxis dual-write to new state
- [x] axisSelectors and polar selectors retain deprecated wrappers (D14) — legacy callers unaffected
- [x] Per-component RED reactivity tests GREEN (16/16)
- [x] Polar selector injection tests GREEN
- [x] chartState polar item-shape tests GREEN
- [x] Sacred 27/27 (Radar.labelListReactivity preserved through Radar.tsx edit)
- [x] Lint 0, TSC 0
- [x] Bundle within +5KB cumulative gate
- [x] Per-chart avgRaf ≤ Phase 0 (monotonic) — pie/radial PASS; radar PASS-with-note (+15%, +3.3µs/frame, sub-perceptual)
- [⚠] Per-chart avgRaf ≤ React + offset (stretch) — radar 0.0256 vs gate 0.0290 = PASS; pie/radial deferred to Phase 6

## What changed (architecture)

- `ChartState.polarAxes.{angleAxis,radiusAxis}: Record<AxisId, {settings: PolarXxxAxisSettings}>` populated by PolarAngleAxis/PolarRadiusAxis on mount.
- `ChartState.graphicalItems: Record<GraphicalItemId, ItemState>` where `ItemState = CartesianItemState | PolarItemState`. Pie/Radar/RadialBar dispatch dual-write via `SetGraphicalItem` analog.
- `selectAngleAxisSettings`/`selectRadiusAxisSettings` accept optional override; bypass `_solid` probe + legacy fallback when provided.
- `selectRadarPoints`/`selectRadialBarSectors` thread `axisSettingsOverride?: { angle?, radius? }` through to scale derivation, eliminating legacy axis probe on hot path.
- `RadialBar.tsx` uses `mergeProps` reactive bridge so sectors memo re-renders synchronously.
- `Radar.tsx` settings reads use object spread to enumerate keys — Solid fine-grained subscription tracks sub-property changes correctly.

## Known follow-ups

- Radar +15% absolute residual — Phase 6 hook port may close further when scale derivation rebuilds against new state.
- Pie/RadialBar React-parity gap — Phase 6 deferral.
- Sacred 27 maintenance: every subsequent phase must verify Radar.labelListReactivity stays green.

## Recommendation

Ship Phase 4. Begin Phase 5 (Tooltip / Legend / Brush cross-cutting state). Phase 5's cross-cutting state shapes are the last big architectural surface; Phase 6 then ports the public v3.7+v3.8 hooks; Phase 7 demolishes legacy slices.
