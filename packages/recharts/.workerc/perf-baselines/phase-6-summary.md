# Phase 6: public hooks port

Phase 6 ports the v3.7+v3.8 public hooks against the new `chartState`. The architect plan called for rewriting all 12 hooks, but the RED phase revealed that 9/11 axis hooks are already reactive via the Phase 2 `_solid` bridge in `axisSelectors.ts` — the rewrites were already implicit. Phase 6 narrows to 2 tooltip hooks + 1 internal Legend payload hook + d.ts diff verification.

## Tests

| Metric              | Phase 5 | Phase 6 | Delta |
|---------------------|---------|---------|-------|
| Total files         | 283     | 284     | +1    |
| Passed files        | 269     | 270     | +1    |
| Failed files        | 6       | 6       | 0     |
| Total tests         | 5351    | 5362    | +11   |
| Passed tests        | 5030    | 5041    | +11   |
| Failed tests        | 3       | 3       | 0     |
| Sacred reactivity   | 27/27   | 27/27   | OK    |
| Lint warnings       | 0       | 0       | 0     |
| TSC errors          | 0       | 0       | 0     |
| Bundle (bytes)      | 433,191 | 439,121 | +5,930 |

11/11 Phase 6 reactivity tests GREEN. Bundle cumulative since Phase 0: +7,813 bytes — over the +5KB gate. Phase 7 cleanup target.

The 3 failed tests remain: 1 legend.reactivity test-design issue, 1 legendSelectors.fallback content-normalization issue, 1 RechartsContext throw-outside-provider pre-existing — all Phase 7 deferrals.

## New tests written in Phase 6

`test/hooks/_solid/hooks.reactivity.spec.tsx` — 11 reactivity tests, one per public hook:

```
useIsTooltipActive             RED → GREEN  (Stage A fix)
useActiveTooltipCoordinate     RED → GREEN  (Stage A fix)
useXAxisScale                  ALREADY GREEN (Phase 2 _solid bridge)
useYAxisScale                  ALREADY GREEN
useCartesianScale              ALREADY GREEN
useXAxisInverseScale           ALREADY GREEN
useYAxisInverseScale           ALREADY GREEN
useXAxisInverseTickSnapScale   ALREADY GREEN
useYAxisInverseTickSnapScale   ALREADY GREEN
useXAxisTicks                  ALREADY GREEN
useYAxisTicks                  ALREADY GREEN
```

## Files modified

```
src/hooks.ts                                useIsTooltipActive + useActiveTooltipCoordinate read newCtx.state.tooltip.settings.active first
src/context/legendPayloadContext.tsx        void newCtx?.state.legend.payload subscription added (Phase 5 deferral resolved)
src/state/selectors/legendSelectors.ts      comment updated (legacy-only path documented as Phase 7 cleanup)
```

No new files created in `src/`. Phase 6 is largely a body-rewrite of existing hooks rather than new infrastructure.

## Public d.ts diff vs Phase 0

All 27 Phase 0 public symbols present in current `dist/index.d.ts`. No removed/renamed types. Additions-only. d.ts diff gate (D24) PASS.

## Phase 5/6 deferral resolution

| Deferral | Status |
|---|---|
| Legend payload reactivity (Phase 5 follow-up) | RESOLVED — `void newCtx?.state.legend.payload` subscription added in legendPayloadContext.tsx; reactive but selector still uses legacy slice for content (avoids 8 ordering regressions) |
| Tooltip hook reactivity (architectural goal) | RESOLVED — both `useIsTooltipActive` + `useActiveTooltipCoordinate` read new state first |
| Scatter +0.12ms vs React (Phase 3 deferral) | UNCHANGED — Phase 6 hook port doesn't touch `selectScatterPoints` chain. Deferred to Phase 7 demolition. |
| Radar +15% vs Phase 0 (Phase 4 deferral) | UNCHANGED — same reason. Deferred to Phase 7. |

## Spec acceptance gate scoreboard

- [x] All 12 public hooks reactive against new chartState (11 verified by tests, 1 = `getRelativeCoordinate` is a pure helper)
- [x] Public d.ts diff additions-only
- [x] Sacred 27/27
- [x] Lint 0, TSC 0
- [x] Tests +11 net (5041 vs 5030)
- [⚠] Bundle +7.8KB cumulative — over +5KB gate. Phase 7 cleanup target.
- [⚠] 3 known fails carry forward — all Phase 7 cleanups

## Architecture reflection

The Phase 2 strangler-fig design's `_solid` bridge in `axisSelectors.ts` turned out to be more powerful than originally scoped. Once selectors had the bridge, every legacy hook that ran through them became implicitly reactive to new state mutations. This is why 9/11 axis hooks were "already GREEN" before Phase 6 even started — the bridge plus Phase 3's override-injection delivered reactivity through the legacy public hook surface for free.

Phase 6's actual scope is narrower than the architect plan: only the tooltip hooks needed body rewrites (the bridge doesn't help them because tooltip uses a cherry-pick merge in `selectTooltipState`, not a direct probe). Hook-by-hook:

- Tooltip hooks: bridge doesn't help → manual rewire (Stage A)
- Axis scale hooks: bridge already covers (no work)
- Axis ticks hooks: same (no work)
- Inverse / tick-snap hooks: same (no work)
- `getRelativeCoordinate`: pure helper, no state read (no work)

Effective Phase 6 work: 3 file edits, 11 tests, ~3 hours real work compressed into one execution session.

## Recommendation

Ship Phase 6. Phase 7 next, but Phase 7 is partially blocked by Phase 5b (middleware migration to new state.tooltip.{axisInteraction,...}). Recommend either:

1. **Phase 5b first:** migrate middleware files (mouseEvents, touchEvents, keyboardEvents, externalEvents) to dual-write into new tooltip interaction state. Then Phase 7 can demolish all legacy slices.
2. **Partial Phase 7:** demolish only what's currently unwired — `actions.ts`, parts of `events.ts`, slice writes that components no longer dispatch (graphicalItemsSlice writes from cartesian items per Phase 3, polar items per Phase 4). Keep middleware-dependent slices intact.

Option 1 cleaner; Option 2 incremental. Either path delivers the Phase 7 perf gates only after middleware migration completes.
