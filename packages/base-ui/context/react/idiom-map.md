---
tags: [react, porting, idioms, hooks]
sources: [packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/store/SolidStoreV2.ts, packages/base-ui/packages/solid/src/utils/useControlled.ts, packages/base-ui/packages/solid/src/popover/root/PopoverRoot.tsx, packages/base-ui/packages/solid/src/select/root/SelectRoot.tsx, packages/base-ui/packages/react/src/popover/root/PopoverRoot.tsx, packages/base-ui/packages/utils/src/store/ReactStore.ts]
verified: 2026-10-17
---

# React to Solid idiom map

How each React idiom in `packages/react` and `packages/utils` is written in the Solid port. The port keeps React's names where the shape survives (store methods, `useControlled`, `useRef`). It replaces render-cycle hooks with Solid primitives and the helpers in `solid-helpers.tsx` and `solid-1-compat.ts`.

Compare `packages/react/src/popover/root/PopoverRoot.tsx` with `packages/solid/src/popover/root/PopoverRoot.tsx`: the files keep the same order line by line. Paths below are relative to `packages/base-ui/packages/`.

## Props and parameters

| React | Solid port |
| --- | --- |
| `const { open, modal = false } = props` (`react/src/popover/root/PopoverRoot.tsx:27`) | One thunk per prop: `const modal = () => props.modal ?? false` (`solid/src/popover/root/PopoverRoot.tsx:29`, `solid/src/select/root/SelectRoot.tsx:66`). Never destructure (root `AGENTS.md`). |
| Plain values into a hook | `MaybeAccessor<T>` parameters, unwrapped with `access()` (`solid-helpers.tsx:51`, `:144`). Store init receives getters (`PopoverRoot.tsx:33`). |
| `{...rest}` / `mergeProps` | Spread `{...props}` keeps getters. The compat `mergeProps` and `splitProps` (`solid-1-compat.ts:16`, `:84`), `omitComponentProps` and `splitComponentProps` (`solid-helpers.tsx:159`, `:169`). Mind [GOTCHA-011](../solid/gotchas.md#gotcha-011-two-mergeprops-with-opposite-undefined-rules). |
| Callback prop called later | Read at call time: `untrack(() => props.onOpenChange)?.(…)` (`PopoverRoot.tsx:59-62`) |
| `defaultProps` pattern | `defaultProps` (`solid-helpers.tsx:219`) |

## State and store

| React | Solid port |
| --- | --- |
| `useState(initial)` | `createSignal(untrack(() => initial))`. Store a function value as `createSignal(() => fn)`. |
| `ReactStore` (`utils/src/store/ReactStore.ts`) | `SolidStore` factory (`solid/src/utils/store/SolidStoreV2.ts:31`) with the same method names. Details in [store and state](../architecture/store-and-state.md). |
| `store.useState('open')` returns a value | Returns an accessor, so call `open()` (`PopoverRoot.tsx:54`) |
| `store.useSyncedValue(s)` (a layout effect copy) | A writable memo bound to the key. Readers see it in the same flush. |
| `store.useControlledProp(key, value)` | Same call. It derives the key from the controlled accessor. |
| `store.useContextCallback(name, fn)` | Same call, run once at setup. `fn` reads props untracked when invoked. |
| `useControlled({ controlled, default })` (`utils/src/useControlled.ts`) | `useControlled` (`solid/src/utils/useControlled.ts`) takes accessors and returns `[Accessor, setter]`. The mode is fixed untracked at setup. Untracked reads see the latest uncontrolled write. 19 call sites. |
| `useMemo(fn, deps)` | `createMemo(fn)`, or `createDepsMemo(deps)` when React's `Object.is` dependency semantics matter (`solid-helpers.tsx:111`) |

## Effects

| React | Solid port | Notes |
| --- | --- | --- |
| `useEffect(fn, deps)` | `createEffect(compute, apply)` (117 sites), where the apply returns the cleanup | `PopoverRoot.tsx:79` ports `React.useEffect(…, [store, open])` as `createEffect(open, (isOpen) => …)`. The apply runs on every recompute ([GOTCHA-005](../solid/gotchas.md#gotcha-005-effect-apply-runs-even-when-compute-returns-the-same-value)). |
| `useEffect` with an exact dependency array | `createDepsEffect(() => ({ a, b }), (deps, prev) => …)` (`solid-helpers.tsx:103`, 71 sites) | Adds a memo with `shallowEqual` in front of the effect |
| `on(deps, fn)` from Solid 1 code | `createEffect(...on(deps, fn))` (`solid-1-compat.ts:114`) | Untracked apply |
| `useLayoutEffect` / `useIsoLayoutEffect` | `createLayoutEffect` (65 sites) or `createDepsRenderEffect` (`solid-helpers.tsx:121`, `:131`) | Render-queue timing. No apply on the server ([GOTCHA-014](../solid/gotchas.md#gotcha-014-server-render-effects-run-their-apply)). |
| `useEffect(fn, [])` / `useOnMount` | `onSettled(fn)` (33 sites), which returns its cleanup | No `onCleanup` or primitives inside ([reactivity](../solid/reactivity.md)) |
| `useImperativeHandle(ref, factory, deps)` | `onSettled(() => { if (props.actionsRef) props.actionsRef.current = {…} })` (`PopoverRoot.tsx:86`) | Assigned once after mount. Members read live state, so no dependency list. |
| `ReactDOM.flushSync(fn)` | `flushSync` (`solid/src/utils/flushSync.ts`) wraps `flush` (16 sites) | |

## Refs and callbacks

| React | Solid port |
| --- | --- |
| `useRef(v)` | `useRef` (`solid-helpers.tsx:201`) returns a plain `{ current }`. The body runs once, so it persists without hooks. |
| `useRefWithInit` | A plain variable or object in the body |
| DOM `ref={setEl}` (called with `null` on unmount) | Solid calls a ref once and never with `null`. `useRenderElement` replays React semantics for a part's own refs. See [refs and events](../solid/refs-and-events.md). |
| `useMergedRefs(a, b)` (`utils/src/useMergedRefs.ts`) | No hook. Pass an array (`ref: [a, b]`), or let `mergeProps` chain refs (`MERGED_REFS`) for `useRenderElement` to deduplicate. |
| `forwardRef` | `ref` is an ordinary prop |
| `useStableCallback(fn)` (`utils/src/useStableCallback.ts`) | No hook. Closures are created once. Read the latest props inside them with `untrack(() => props.x)`, or wrap store and context reads with `live()` (`solid-helpers.tsx:140`). |
| `useValueAsRef(value)` | `live(() => value())` or a direct untracked read |

## Context

| React | Solid port |
| --- | --- |
| `React.createContext<T \| undefined>(undefined)` | `createContext<T \| null>(null)`, compared with `!= null` ([GOTCHA-015](../solid/gotchas.md#gotcha-015-undefined-context-defaults-throw)) |
| `<Ctx.Provider value>{children}</Ctx.Provider>` | `provideContext(Ctx, value, () => children)` (`solid-helpers.tsx`): one transparent owner on the client, the provider on the server and while hydrating. Native parts use `provideNativeContext` (`solid/src/utils/native/context.ts`). |
| `React.useContext(Ctx)` | `useContext(Ctx)`. Values are stable objects with getters or accessors, so nothing re-renders. |

## Lists, ids, timers, rendering

| React | Solid port |
| --- | --- |
| `items.map((x) => <Item key={…} />)` | `<For each={…}>` (`SelectRoot.tsx:757`) or `mapArray`. No `key` prop. |
| `CompositeList` render-order indices | `CompositeList` registration through `register`/`unregister` with a sorted map (`solid/src/internals/composite/list/CompositeList.tsx`). Native items use `createNativeListItem` (`solid/src/utils/native/listItem.ts`). See [composite lists](../architecture/composite-lists.md). |
| `useId()` returns a string | `useId()` returns an `Accessor<string>` built on `createUniqueId` (`solid/src/utils/useId.ts`) |
| `useTimeout`, `useAnimationFrame` | Same names (`solid/src/utils/useTimeout.ts`, `useAnimationFrame.ts`). Cleanup registers on the owner. |
| `useRenderElement` + `render` prop + `cloneElement` | `useRenderElement` returns a component. `render` is a function or element, read once when static. See [render pipeline](../architecture/render-pipeline.md). |
| `useMemo(() => <X />)` | Never. See [GOTCHA-004](../solid/gotchas.md#gotcha-004-components-inside-creatememo). |

## Related

- [Reactivity](../solid/reactivity.md), [port a component](../workflows/port-a-component.md), [parity](../testing/parity.md).
