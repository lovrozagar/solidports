# Phase 1: Solid-native chart state primitive (parallel implementation)

Phase 1 builds the new `RechartsStateContext` / `useChartState` / `RechartsStateProvider` primitive in isolation. Nothing in the chart-component tree consumes it yet — it sits parallel to the legacy `RechartsStoreProvider` until Phase 2 wires the first axis migration.

## Tests

| Metric              | Phase 0 | Phase 1 | Delta |
|---------------------|---------|---------|-------|
| Total files         | 260     | 263     | +3    |
| Passed files        | 247     | 250     | +3    |
| Failed files        | 6       | 6       | 0     |
| Total tests         | 5230    | 5241    | +11   |
| Passed tests        | 4912    | 4923    | +11   |
| Failed tests        | 3       | 3       | 0     |
| Sacred reactivity   | 27/27   | 27/27   | OK    |
| Lint warnings       | 0       | 0       | 0     |
| TSC errors          | 0       | 0       | 0     |
| Bundle (bytes)      | 431,308 | 431,020 | -288  |

The 6 remaining failed files are unchanged: 3 known JSX-crash files (LineChart / AreaChart / AccessibilityScans) + 3 perf-bench infra timeouts. No new failures introduced.

### New tests written in Phase 1

- `test/state/_solid/RechartsContext.spec.tsx` — 5 unit tests
  1. provides state to descendants — read returns initial state
  2. setState mutates state — descendants see new value
  3. throws when useChartState is called outside provider (`@solidports/recharts:` prefixed error)
  4. each provider instance owns its own state (per-chart isolation)
  5. preloadedState seeds the store
- `test/state/_solid/integration.spec.tsx` — 3 skipped (parked until Phase 2 wires `RechartsStateProvider` into `generateCategoricalChart`)
- `test/state/_solid/chartState.spec.ts` — 3 factory tests (added during second cleanup pass)
  1. createInitialChartState returns a fresh instance per call
  2. nested objects are not shared between calls
  3. function fields would survive the factory (regression guard for Phase 2's `LegendItemSorter`)

Total Phase 1 active unit tests: 8 GREEN, 3 skipped.

## Files added

- `src/state/_solid/chartState.ts` — `ChartState` type + `createInitialChartState()` factory + per-slice `make*State()` helpers
- `src/state/_solid/RechartsStateContext.tsx` — typed `createContext<RechartsStateContextValue | undefined>`
- `src/state/_solid/useChartState.ts` — hook with `@solidports/recharts:` prefixed error
- `src/state/_solid/RechartsStateProvider.tsx` — provider component creating per-instance store, accepts optional `preloadedState`
- `test/state/_solid/RechartsContext.spec.tsx`
- `test/state/_solid/integration.spec.tsx`
- `test/state/_solid/chartState.spec.ts`

## Files modified during Phase 1 cleanup pass

- `src/state/_solid/chartState.ts` — replaced `JSON.parse(JSON.stringify(...))` deepClone with explicit `make*State()` factories; dropped `INITIAL_CHART_STATE` singleton export.

## What changed

- New parallel context primitive sits next to the legacy store; no chart components consume it yet.
- Public API surface unchanged — `phase-0-public-api.d.ts` diff is empty.
- Bundle is 288 bytes smaller (the dropped `INITIAL_CHART_STATE` const was the only delta; new files are unimported and tree-shaken).

## What was rejected

- `JSON.parse(JSON.stringify(state))` deepClone — drops function-valued fields (Phase 2 risk on `LegendItemSorter`). Replaced with literal-construction factories per slice.
- `INITIAL_CHART_STATE` singleton export — mutation footgun. Replaced by always calling `createInitialChartState()`.
- `Map<AxisId, AxisState>` collections (per spec D3) — `Record<AxisId, AxisState>` works with Solid `createStore` reactivity out of the box.

## Spec acceptance gate scoreboard

- [x] ≥5 unit tests on the new primitive — 5 unit + 3 factory = 8 active
- [x] Original tests still pass — sacred 27/27 GREEN, no other regressions
- [x] Lint 0, TSC 0
- [x] Bundle ≤ Phase 0 + 5KB — actual delta -288 bytes
- [~] Perf ±5% — Phase 1 wires no chart components into the new state, so perf is flat by construction. Spec allows skip-if-no-wiring.

## Phase 2 readiness notes

- `createInitialChartState()` is the single entry point — no singleton to defend.
- `ChartState.cartesianAxes.{xAxis,yAxis,zAxis}: Record<AxisId, ...>` is already in the shape Phase 2 needs. `setState("cartesianAxes", "xAxis", id, settings)` is the prescribed write path.
- Phase 1 axis state types (`XAxisState` / `YAxisState` / `ZAxisState`) are `Record<string, unknown>` stubs. Phase 2 widens them inline in `chartState.ts` using existing slice types (`XAxisSettings` / `YAxisSettings` / `ZAxisSettings`) — no provider/context-file edits required.
- `RechartsStateProvider.tsx:21` carries an intentional `eslint-disable solid/reactivity` — Phase 2 must not touch that line.
- Integration tests remain `.skip` until Phase 2 mounts `RechartsStateProvider` outside `RechartsStoreProvider` in `generateCategoricalChart.tsx` (per spec D2).

## Recommendation

Ship Phase 1. Begin Phase 2 (cartesianAxis migration via strangler fig).
