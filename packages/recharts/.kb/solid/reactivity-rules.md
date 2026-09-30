# Solid reactivity rules — @solidports/recharts

## Hard rules

**Never destructure props or store at the call site.**
Solid's proxy-based tracking breaks on destructuring. Always `props.foo`, `store.layout.width`, etc.

**Every derived value = `createMemo`.**
Inline computation in JSX re-runs on every render. `createMemo` memoizes and tracks precisely:
```ts
const offset = createMemo(() => computeOffset(store.layout.width, store.layout.margin))
```

**`batch()` in event handlers with multiple setters.**
Without batch, each setter triggers a separate reactive sweep. Wrap multi-setter handlers:
```ts
onClick={() => batch(() => {
  actions.setMouseClickAxisIndex(payload)
  actions.setTooltipSettings(settings)
})}
```

**`createEffect` + `onCleanup` — not `useEffect`.**
No React imports. Cleanup always inside the same effect scope:
```ts
createEffect(() => {
  const id = setTimeout(fn, delay)
  onCleanup(() => clearTimeout(id))
})
```

**`onMount` for one-shot DOM reads.**
ResizeObserver, initial size measurement, and similar go in `onMount`. Not in `createEffect`.

**Store writes via actions only.**
Never call `setStore` directly from a component. Always go through `createActions`-returned methods.

## Selector tiers

Tier 1 — direct store access (no memo needed):
```ts
const width = store.layout.width  /* tracked automatically in JSX */
```

Tier 2 — derived state (wrap in createMemo):
```ts
const offset = createMemo(() => combineChartOffset(store.layout, store.legend.size))
```

Tier 3 — parameterized (pass params directly, no picker hack):
```ts
function useAxisDomain(axisType: AxisType, axisId: AxisId) {
  return createMemo(() => combineAxisDomain(store.cartesianAxis[axisType][axisId]))
}
```

Tier 4 — combiners: keep unchanged, they are pure functions.

## Common mistakes

- Using `createEffect` to watch a prop and set local state → use `createMemo` instead.
- Calling `store.x` inside a non-tracking scope (setTimeout callback, promise handler) → capture in a memo or read before the async boundary.
- Wrapping children-producing logic in `createMemo` → causes remount; use accessor pattern or `<Show>` / `<For>` directly.
