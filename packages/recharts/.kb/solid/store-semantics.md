# Store semantics — @solidports/recharts

Full design lives in `../concepts/store-design.md`. This file is a quick-reference pointer.

## TL;DR

One `createStore<ChartStore>` per chart instance, created in `ChartProvider`.
Actions are plain functions returned by `createActions(store, setStore)`.
Selectors are `createMemo` hooks — read `store.*` directly for Tier 1, wrap in memo for Tier 2+.

## Access pattern

```ts
const { store, actions } = useChartStore()

/* Tier 1 — direct, tracked */
const w = store.layout.width

/* Tier 2 — derived, memoized */
const offset = createMemo(() => combineOffset(store.layout, store.legend.size))

/* Write — always via actions */
actions.setChartSize(800, 600)
```

## What replaces what

    Redux                     Solid
    configureStore            createStore()
    createSlice reducers      actions.* functions
    useSelector               store.* property access
    useDispatch + action      actions.*()
    reselect createSelector   createMemo()
    middleware                event handlers in createEventHandlers()

See `../concepts/store-design.md` for the full `ChartStore` type, `createActions` listing, event handler patterns, and migration checklist.
