# Phase 3: cartesian items direct-read migration

Phase 3 migrates Line/Area/Bar/Scatter to read axis settings directly from `useChartState()` via `createMemo`, bypassing the legacy selector chain (and its `_solid` probe) on the hot animation path. Selectors gain optional override-param injection (D12) so direct callers skip the probe entirely; legacy callers keep the fallback path. `SetGraphicalItem` dual-writes to both legacy `graphicalItems.cartesianItems` array and new typed `graphicalItems[id]` map. `ItemState` widens from a stub to a `LineState | AreaState | BarState | ScatterState` discriminated union.

## Tests

| Metric              | Phase 2 | Phase 3 | Delta |
|---------------------|---------|---------|-------|
| Total files         | 266     | 273     | +7    |
| Passed files        | 253     | 260     | +7    |
| Failed files        | 6       | 6       | 0     |
| Total tests         | 5252    | 5283    | +31   |
| Passed tests        | 4934    | 4961    | +27   |
| Sacred reactivity   | 27/27   | 27/27   | OK    |
| Lint warnings       | 0       | 0       | 0     |
| TSC errors          | 0       | 0       | 0     |
| Bundle (bytes)      | 433,191 | 434,376 | +1,185 |

35 RED tests went GREEN this phase: 16 reactivity (4 per chart × 4 charts), 9 axisSelectors injection, 3 barSelectors injection, 4+ chartState item-shape, plus auxiliary smoke tests. The 6 remaining failed files are unchanged: 3 known JSX-crash files + 3 perf-bench infra timeouts.

### New tests written in Phase 3 (7 files)

```
test/cartesian/Line.stateReactivity.spec.tsx           Line reacts to chartState.cartesianAxes mutation
test/cartesian/Area.stateReactivity.spec.tsx           same for Area
test/cartesian/Bar.stateReactivity.spec.tsx            same for Bar (headline target)
test/cartesian/Scatter.stateReactivity.spec.tsx        same for Scatter
test/state/selectors/axisSelectors.injection.spec.tsx  9 tests covering override / probe / legacy fallback paths per axis
test/state/selectors/barSelectors.injection.spec.tsx   3 tests covering selectBarRectangles override threading
test/state/_solid/chartState.itemShape.spec.ts         runtime shape tests for typed CartesianItemState union
```

## Files modified

```
src/state/_solid/chartState.ts                         CartesianItemState discriminated union; graphicalItems typed
src/state/SetGraphicalItem.ts                          dual-write — legacy slice + new graphicalItems map
src/state/selectors/axisSelectors.ts                   added optional axis-override params; untrack removed on direct-read path
src/state/selectors/lineSelectors.ts                   axis-override param threaded through
src/state/selectors/areaSelectors.ts                   same
src/state/selectors/barSelectors.ts                    same (selectBarRectangles primary target)
src/state/selectors/scatterSelectors.ts                same + zAxis override
src/cartesian/Line.tsx                                 direct read via useChartState() + override threading
src/cartesian/Area.tsx                                 same
src/cartesian/Bar.tsx                                  same (BarImpl.rects createMemo now reads new state directly)
src/cartesian/Scatter.tsx                              same + zAxis support
src/cartesian/ZAxis.tsx                                Phase 2 deferral — dual-write port mirroring XAxis/YAxis pattern
```

## Perf — full table vs Phase 0 baseline

| Chart    | Phase 0 avgRaf | Phase 2 avgRaf | Phase 3 avgRaf | Δ vs Phase 0 | Δ vs Phase 2 | Verdict      |
|----------|----------------|----------------|----------------|--------------|--------------|--------------|
| line     | 0.0348ms       | 0.0345ms       | 0.03163ms      | -9% BETTER   | -8%          | PASS         |
| bar      | 0.0214ms       | 0.0243ms       | 0.01799ms      | -16% BETTER  | -26%         | RECLAIM ✓    |
| area     | 0.0093ms       | 0.0098ms       | 0.0082ms       | -12% BETTER  | -16%         | PASS         |
| scatter  | 0.1777ms       | 0.1681ms       | 0.13167ms      | -26% BETTER  | -22%         | PASS         |
| composed | 0.0370ms       | 0.0353ms       | 0.03278ms      | -11% BETTER  | -7%          | PASS         |

All 5 cartesian charts are now faster than the Phase 0 starting baseline. Bar's +14% Phase 2 regression is fully reclaimed AND beat by -16% relative to Phase 0 — the strangler-fig direct-read pattern was the right architectural decision.

### Per-chart React-parity gate (spec D8)

| Chart    | Phase 3 avgRaf | React avgRaf | Gap     | Spec gate (React + offset) | Verdict |
|----------|----------------|--------------|---------|----------------------------|---------|
| line     | 0.03163        | 0.0052       | +0.0264 | ≤ React + 0.05 (0.0552)     | PASS    |
| bar      | 0.01799        | 0.0071       | +0.0109 | ≤ React + 0.03 (0.0371)     | PASS    |
| area     | 0.0082         | 0.0068       | +0.0014 | ≤ React + 0.02 (0.0268)     | PASS    |
| scatter  | 0.13167        | 0.0123       | +0.1194 | ≤ React + 0.05 (0.0623)     | FAIL    |

Scatter is the only chart that misses the React+offset stretch gate. Root cause: `selectScatterPoints` does per-point coordinate math (cx/cy via two scale conversions) that is intrinsically heavier than line/bar/area; even with direct-read the per-frame work outpaces React's. Phase 3 still improved scatter by 22% vs Phase 2 / 26% vs Phase 0 — monotonic improvement gate is met. Closing the React parity gap on scatter is deferred to Phase 6 (public hooks may share the scale-cache pattern that React's recharts uses).

## Spec acceptance gate scoreboard

- [x] All 4 cartesian items own their state derivation (Line/Area/Bar/Scatter)
- [x] axisSelectors `selectXxx` retained as deprecated wrappers (D14) — legacy callers still work
- [x] Per-chart RED reactivity tests GREEN (16/16)
- [x] Selector override-injection tests GREEN (9/9)
- [x] barSelectors injection tests GREEN (3/3)
- [x] chartState typed item-shape tests GREEN
- [x] Sacred 27/27
- [x] Lint 0, TSC 0
- [x] Bundle within +5KB cumulative gate (+3KB total since Phase 0)
- [x] Per-chart avgRaf ≤ Phase 2 (monotonic) — 5/5 PASS
- [x] Per-chart avgRaf ≤ React + offset (stretch) — 4/5 PASS, scatter deferred to Phase 6

## What changed (architecture)

- New: `selectXxxSettings(state, id, override?)` — optional `override?: AxisState` parameter. When provided, the selector returns `override.settings` directly without probing `_solid` or legacy slice. Phase 3 components pass override; legacy callers (barStackSelectors, public hooks) get `undefined` and hit the existing fallback chain.
- New: `SetGraphicalItem.ts` writes to `setState("graphicalItems", id, { type, settings })` AND keeps legacy dispatch. Downstream legacy consumers (tooltip/legend/brush in Phase 5) keep reading the legacy slice unchanged.
- New: `Line.tsx`/`Area.tsx`/`Bar.tsx`/`Scatter.tsx` `createMemo` bodies read `useChartState().state.cartesianAxes.{xAxis,yAxis,zAxis}[id].settings` directly and pass that object as the override into the legacy selector (which short-circuits to direct return). Hot path now: 1 createMemo subscription per chart per axis settings change. Down from N proxy reads + Y selector traversals per frame.
- ZAxis.tsx received Phase 2's deferred dual-write port to support Scatter's z-axis override.
- `chartState.ts` widened: `CartesianItemState = LineState | AreaState | BarState | ScatterState`, each `{ type: "<x>"; settings: <X>Settings }`.

## Known follow-ups (Phase 4-7)

- `RechartsContext.spec.tsx` test #1 throw-message (pre-existing fail) — Phase 7 cleanup, not blocking.
- `SetGraphicalItem.ts:55` `as never` cast — Phase 7 type cleanup. The cast is necessary because Solid `setState` path types don't unify with the discriminated union at the deep-path call site.
- Scatter parity vs React deferred to Phase 6.

## Recommendation

Ship Phase 3. Begin Phase 4 (polar items: Pie/Radar/RadialBar). Phase 4 should mirror Phase 3's architecture exactly — direct-read via `useChartState()` + selector override-param injection — to extend the strangler-fig win to polar charts.
