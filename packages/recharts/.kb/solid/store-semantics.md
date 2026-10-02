# Store semantics — @solidports/recharts

One Solid store per chart: `createStore<ChartState>` (`src/state/chartState.ts`), created by
`RechartsStateProvider`. There is no Redux, no slice reducers and no dual-write layer.
`../concepts/store-design.md` keeps the original design rationale.

## Where things live

    src/state/chartState.ts           ChartState type, initial-state factories, readChartState
    src/state/RechartsStateProvider.tsx creates the store (panorama charts reuse the parent's)
    src/state/RechartsStateContext.tsx  { state, setState }       — useChartState / useOptionalChartState
    src/state/RechartsStoreContext.tsx  { store, setStore, events } — useChartStore (null outside a chart)
    src/state/actions.ts              createActions(store, setState): mutations replacing upstream reducers
    src/state/events.ts               chart event handlers replacing upstream event middlewares
    src/state/selectors/**            plain functions over ChartState (no reselect); callers memoize
    src/state/*Slice.ts               state types + initial-state factories only

## Access pattern

```ts
const ctx = useChartStore()
/* derived values: memoize at the consumer */
const offset = createMemo(() => (ctx ? selectChartOffsetInternal(ctx.store) : undefined))

/* writes from effects / handlers, never from component bodies or memos */
createEffect(
	() => ({ width: props.width }),
	(next) => ctx?.setStore("layout", "width", next.width),
)
```

- Path setters go through `src/util/solid-1-compat` (`SetStoreFunction<T>` is typed per path).
- Teardown writes use `teardownWrite` (disposal can run inside a computation).
- Removing a store entry compares with `isSameStoreEntry` (entries are proxies).
- Chart roots seed `layout` / `chartData` at store creation (GOTCHA-019: nodes first read during a pending write can stay stale).
- Chart data is stored raw through `markRawData` (GOTCHA-025): replace it, never mutate rows.
- Writes land on the next microtask; tests call `flush()` before reading.

## What replaces what

    Redux                     Solid
    configureStore            createStore<ChartState>()
    createSlice reducers      createActions(...) / setStore path writes
    useAppSelector            selector(store) inside createMemo / JSX
    useAppDispatch + action   actions.*() or setStore(...)
    reselect createSelector   plain functions + consumer createMemo
    middleware                createEventHandlers (src/state/events.ts)
