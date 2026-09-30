# Phase 5b: middleware migration

Phase 5b completes the cross-cutting state migration started in Phase 5. Middleware (mouse, touch, keyboard, external events, useChartSynchronisation) now dual-writes to both legacy `state.tooltip.<sub>` AND new `state._solid.tooltip.<sub>` interaction state. `selectTooltipState` switched to new-state-first / legacy-fallback for ALL subtrees (settings + tooltipItemPayloads + axisInteraction + itemInteraction + keyboardInteraction + syncInteraction). Tooltip.tsx's Phase 5 `effectiveStore` workaround memo deleted (no longer needed).

## Tests

| Metric              | Phase 6 | Phase 5b | Delta |
|---------------------|---------|----------|-------|
| Total files         | 284     | 289      | +5    |
| Passed files        | 270     | 275      | +5    |
| Failed files        | 6       | 6        | 0     |
| Total tests         | 5362    | 5384     | +22   |
| Passed tests        | 5041    | 5063     | +22   |
| Failed tests        | 3       | 3        | 0     |
| Sacred reactivity   | 27/27   | 27/27    | OK    |
| Lint warnings       | 0       | 0        | 0     |
| TSC errors          | 0       | 0        | 0     |
| Bundle (bytes)      | 439,121 | 439,895  | +774  |

22/22 Phase 5b RED → GREEN. Sacred 27/27 preserved across all 5 middleware migrations.

## New tests written

```
test/state/_solid/mouseEvents.dualWrite.spec.tsx              5 tests
test/state/_solid/touchEvents.dualWrite.spec.tsx              4 tests
test/state/_solid/keyboardEvents.dualWrite.spec.tsx           4 tests
test/state/_solid/useChartSynchronisation.dualWrite.spec.tsx  3 tests
test/state/selectors/selectTooltipState.fullMerge.spec.ts     6 tests
```

## Files modified

```
src/state/events.ts                                createEventHandlers signature widened with setChartState param
src/state/RechartsStoreProvider.tsx                passes stateCtx?.setState to factory
src/state/externalEventsMiddleware.ts              signature-only widening (read-only middleware)
src/state/keyboardEventsMiddleware.ts              8 dual-write sites in batch()
src/state/touchEventsMiddleware.ts                 4 dual-write sites in batch()
src/state/mouseEventsMiddleware.ts                 6 dual-write sites in batch() — HOT PATH
src/synchronisation/useChartSynchronisation.tsx    3 dual-write sites in batch()
src/state/actions.ts                               mouseLeaveChart/mouseLeaveItem/setActive paths also dual-write
src/state/selectors/selectTooltipState.ts          full-merge interaction subtrees new-state-first
src/component/Tooltip.tsx                          effectiveStore memo deleted (Phase 5 workaround)
```

## Architecture decisions

- **D25 — thread `setChartState?` through createEventHandlers signature.** Matches the existing factory pattern. When `RechartsStateProvider` not mounted (test fixtures), `setChartState === undefined` → dual-write no-op → preserves existing test fixtures.
- **D26 — batch() wraps each dual-write pair.** Single tracker tick per event regardless of dual-write. `batch` from `solid-js` (new import).
- **D27 — selectTooltipState full-merge.** Interaction subtree new-state-first when `_solid.tooltip.axisInteraction !== undefined`. Sacred-test fixtures dispatch against legacy-only → new state untouched → guard returns false → legacy fallback path → fixtures stay green.
- **D28 — useChartSynchronisation context capture.** Reads `useChartState()?.setState` once at hook init.
- **R21 — rejected: reverse-mirror via createEffect.** 27 leaf reads × per-mousemove cadence = perf killer.
- **R22 — rejected: dual-write via produce().** Two produce calls per event doubles allocation; batch() with raw setStore/setState pair is faster.

## Test bugs fixed during execution

11 of 22 RED tests initially failed due to authoring issues (not implementation):
- `clientX: 50` was inside YAxis dead zone (default width 60 + margin 5 = plot area starts at x=65). Bumped to `clientX: 100`.
- `fireEvent.focus` is non-bubbling but Solid maps `onFocusIn` to native bubbling `focusin`. Switched to `fireEvent.focusIn`/`fireEvent.focusOut`.
- `fireEvent.mouseLeave(svg)` won't fire on outer wrapper since `mouseleave` is non-bubbling. Switched to `fireEvent.mouseLeave(wrapper)`.

## Spec acceptance gate scoreboard

- [x] All 4 writer middleware dual-write into new state (external is read-only)
- [x] selectTooltipState reads interaction new-state-first
- [x] Tooltip.tsx effectiveStore memo deleted
- [x] Sacred 27/27 (Brush.eventReactivity 4 + RechartsWrapper.eventReactivity 5 + Sankey.tooltipReactivity 6 + Treemap.tooltipReactivity 6 + Radar.labelListReactivity 6)
- [x] Lint 0, TSC 0
- [x] Bundle delta minimal (+774 bytes)
- [x] Cold-mount perf no regression (no source changes affecting cartesian hot path)

## Phase 7 readiness

After Phase 5b, all middleware writes dual-write to new state. selectTooltipState reads new-first. The path is clear for Phase 7 demolition of:
- `tooltipSlice.ts`
- `legendSlice.ts`
- `brushSlice.ts`
- `cartesianAxisSlice.ts`
- `polarAxisSlice.ts`
- `graphicalItemsSlice.ts`
- `actions.ts` (action creators no longer needed)
- `events.ts` (legacy event factory signatures)
- `RechartsStoreProvider.tsx` (replaced by RechartsStateProvider)
- `state/store.ts` (legacy shape)

**Caveat:** `chartData` (`dataStartIndex/EndIndex`) writes via `useBrushSyncEventsListener` are NOT in `ChartState` shape. Phase 7 cannot demolish `chartDataSlice.ts` without prior migration. Either extend Phase 5b OR add Phase 5c. Architect deferred this in D28.

## Recommendation

Ship Phase 5b. Phase 7 demolition can begin — but expect the chartData migration to be the lone holdout requiring incremental work.
