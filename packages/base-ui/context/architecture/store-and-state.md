---
tags: [store, state, helpers, compat]
sources: [packages/base-ui/packages/solid/src/utils/store/SolidStoreV2.ts, packages/base-ui/packages/solid/src/utils/useControlled.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/native/context.ts]
verified: 2026-10-18
---

# Store and state

Popup and list state lives in `SolidStore` (React `ReactStore` semantics on per-key signals), single values in `useControlled`, and React hook shapes in `solid-helpers.tsx` and `solid-1-compat.ts`. Each helper adds reactive nodes; know the cost before using one in a per-item path.

## `SolidStore` (`utils/store/SolidStoreV2.ts`)

`SolidStore(initialState, context, selectors)` returns a plain object typed as `SolidStoreInstance`, a `declare class`: docs-infra API extraction then expands data members but not methods. Add members with `Object.assign(store, …)`; a spread drops the methods from the type.

Users: popup stores (`utils/popups/store.ts`, Dialog, Popover, Menu, Tooltip, PreviewCard), `FloatingRootStoreV2`, Select, Combobox, Toast, `filter-dropdown`, `NullStore`.

### Backing state (`createStoreState`)

- One ownerless signal per key, created on first read (`equals: false`, boxed so function values are stored, not called).
- The state is a Proxy. Tracked reads subscribe to the key and see the committed value. Untracked reads (handlers, effect applies, store methods) see the latest write before the flush.
- Getter fields stay live and are never written. The key set has a version signal for `has`/`ownKeys`.
- `setState` takes `(key, value)`, a draft function (one patch), or a patch object. A commit skips `Object.is` no-ops, then calls listeners synchronously, guarding recursive writes as React's store does.
- Server: signals are never written; reads return recorded values.

### Methods

| Method | Behavior | Cost |
| :--- | :--- | :--- |
| `useState(key)` | A key, or a selector returning one key as is (probed once, `directSelectorKey`), reads the slot. A derived selector gets a transparent memo on first tracked read. | 0 or 1 memo |
| `select(key, …args)` | Runs the selector; no memo. A selector declared with `keyedSelector(current)` ("is `id` the current one": the popup store's `isTriggerActive`, `isOpenedByTrigger`, `isMountedByTrigger`; the item highlight `isActive` of Select, Combobox and Menu, keyed by the item's index) reads, when tracked on the client, one keyed projection per store and key function (`createKeyedSelector` in `runInLazyScope` of the store's owner, created on the current id's first change), so moving the current id re-runs two readers, not every trigger. Selectors of one key share it: the three trigger selectors key on the active trigger id, and `keyedSelector(key, gate)` reads its gate (`open`, `mounted`) only for the current id. | Per call; 1 projection per key function |
| `useSyncedValue`, `useControlledProp`, `useSyncedValues` | `bindStoreKey`: a writable derived signal, created on first read. `set` overrides it until the source changes; cleanup keeps the last value (`useSyncedValueWithCleanup` clears it). | 1 signal on read |
| `observe(selector, listener)` | Calls once, then after each changing write; records read keys through a Proxy and starts one notifier effect per watched binding. | 1 effect per watched binding |
| `useStateSetter(key)` | Ref-style setter; `null` clears only its own write. | None |

Each tracked read pays a Proxy trap plus Map lookups. Repeated `createMemo(() => store().select(…))` wrappers in popups are covered in [floating](floating.md).

## `useControlled` (`utils/useControlled.ts`)

- Mode and initial value are fixed at setup. Uncontrolled: one signal. Controlled: the signal plus one memo.
- A function-valued default goes through a derived `createSignal(fn)`.
- Tracked reads return the committed value; untracked reads return the latest write.
- The setter ignores writes while controlled. Dev adds one warning effect.

## `solid-helpers.tsx`

| Helper | What it is | Cost | Non-test call sites |
| :--- | :--- | :--- | ---: |
| `createDepsEffect` | React `useEffect(fn, deps)`: effect over a `shallowEqual` memo | memo + effect | 71 |
| `createDepsRenderEffect` | Same, layout timing | memo + render effect | 35 |
| `createLayoutEffect` | Render effect; on the server the node exists (ids align) but the apply does not run | render effect | 64 |
| `createDepsMemo` | `shallowEqual` memo | memo | 4 |
| `provideContext` | Client after hydration: runs `render` once untracked under one transparent owner that carries the context (`createContextOwner`, S2). Server or hydrating: `<Provider>` JSX so owners match (D5). | 1 owner (client) | 111 |
| `useRef(v)` | `{ current: v }`, not reactive | None | 154 |
| `omitComponentProps` | Solid `omit` view without `class`, `render`, own keys | Proxy | 17 |
| `defaultProps` | Compat `mergeProps(defaults, props)` | Proxy | 17 |

- `MaybeAccessor<T>` is `T | Accessor<T>`; `access` calls any zero-arity function, so never pass a zero-arity callback as a plain value.
- `live(read)` tracks inside computations and reads untracked elsewhere.
- Native parts provide the same way on the client and rebuild the provider's owners without its computations while hydrating (`provideNativeContext`); see [render pipeline](render-pipeline.md). `test/ssr/production-client.test.ts` runs a late consumer through the production client runtime, where the provider's unobserved children memo used to be disposed.
- Non-test source has 1111 `.current` occurrences.

## `solid-1-compat.ts`

Solid 1 APIs for ported code, imported by 52 non-test files.

| Export | Semantics | Cost | Files |
| :--- | :--- | :--- | ---: |
| `mergeProps` | Later sources win, `undefined` skipped (Solid 2 `merge` treats it as an override). Keys fixed at call time. | One Proxy; reads walk sources | 29 |
| `splitProps` | Picked groups get one getter per key; the rest is an `omit` view | Getters + Proxy | 18 |
| `on(deps, fn)` | Solid 1 `on()` as `createEffect` arguments; `fn` untracked | None extra | 7 |
| `createStore` | Path-style setters over Solid 2 drafts | Wrapper | 1 |
| `createSelector` | `(key) => fn(source(), key)`: every reader re-runs per change, O(n) | Not keyed | 0 |

The public `mergeProps` (`merge-props/mergeProps.ts`) has React semantics (explicit `undefined` wins, handler chaining) and builds on compat `mergeProps`. Do not adopt the `createSelector` shim for highlight or selection; see [composite lists](composite-lists.md) and [primitive costs](../solid/primitive-costs.md).
