---
tags: [floating, popup, store, interactions, perf]
sources: [packages/base-ui/packages/solid/src/floating-ui-solid, packages/base-ui/packages/solid/src/floating-ui-solid/components/FloatingRootStoreV2.ts, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useFloatingRootContext.ts, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useSyncedFloatingRootContext.ts, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/utils/popups/createPopupFloatingRootContext.ts, packages/base-ui/packages/solid/src/navigation-menu/root/NavigationMenuRoot.tsx, packages/base-ui/packages/react/src/floating-ui-react]
verified: 2026-10-28
---

# Floating UI layer

`src/floating-ui-solid/` ports upstream `floating-ui-react`: one `FloatingRootStore` per popup, kept in sync with the popup store, plus interaction hooks whose prop getters return live views. Its costs are duplicated per-hook memos and a list memo that re-merges every item's props.

## Layout

All paths below are under `packages/base-ui/packages/solid/src/floating-ui-solid/`. Upstream counterpart: `packages/base-ui/packages/react/src/floating-ui-react/`.

| Folder | Contents |
| --- | --- |
| `components/` | `FloatingRootStoreV2.ts`, `FloatingTree.tsx` + `FloatingTreeStore.ts`, `FloatingFocusManager.tsx`, `FloatingPortal.tsx`, `FloatingDelayGroup.tsx` |
| `hooks/` | `useFloating`, `useFloatingRootContext`, `useSyncedFloatingRootContext`, `useClick`, `useDismiss`, `useFocus`, `useHover*`, `useClientPoint`, `useListNavigation`, `useTypeahead`, `useInteractions`, `useRole`, `useFloatingOriginal` |
| `utils/` | `composite.ts` (list index math), `tabbable.ts`, `markOthers.ts`, `event.ts`, `element.ts`, `nodes.ts`, `getEmptyRootContext.ts`, `deepEqual.ts` |
| root | `safePolygon.ts`, `types.ts`, `index.ts`, `middleware/arrow.ts` |

### Solid-only files (no file of the same name upstream)

- `components/FloatingRootStoreV2.ts`: replaces upstream `FloatingRootStore.ts` (a `ReactStore` subclass). A factory over `SolidStore` that adds `setOpen`, `dispatchOpenChange` and `syncOpenEvent` with `Object.assign`.
- `hooks/useFloatingOriginal.ts`: port of `@floating-ui/react-dom`'s `useFloating` (`computePosition`, `whileElementsMounted`, `isPositioned`); `hooks/useFloating.ts` imports it as `usePosition`.
- `utils/deepEqual.ts`: the `@floating-ui/react-dom` position-data equality, used by `useFloatingOriginal`.
- `hooks/useInteractions.ts` and `hooks/useRole.ts`: the upstream snapshot no longer ships them (React parts call `mergeProps` directly). The port keeps them; `useInteractions` is used by `SelectRoot`, `AriaCombobox` and `NavigationMenuTrigger`, and `useRole` is exported from `index.ts`.

## The root store

`FloatingRootStore(options)` builds a `SolidStore` (see [store and state](store-and-state.md)).

- State: `open`, `transitionStatus`, `domReferenceElement`, `referenceElement`, `floatingElement`, `positionReference`, `floatingId`, `elementsMounted`.
- Selectors return `null` for the elements while `elementsMounted` is `false`. React clears the elements on unmount; Solid derives the same result.
- Context (non-reactive): `onOpenChange`, `dataRef`, `events` (emitter), `nested`, `syncOnly`, `triggerElements`.
- `syncOnly: true` means `setOpen` only forwards to `onOpenChange`; the popup store owns `dispatchOpenChange`.
- Options are initial values, read untracked; callers keep the store in sync afterwards.

## Two ways to own a root

### Stable identity (every popup except NavigationMenu)

- Popover, Dialog, Menu, PreviewCard and Tooltip stores create the root at construction with `createPopupFloatingRootContext(triggerElements, floatingId, nested)` (`src/utils/popups/createPopupFloatingRootContext.ts`, `syncOnly: true`) and keep it in `store.context.floatingRootContext`. Upstream React does the same in `state` (`packages/react/src/utils/popups/store.ts:100`). There is no placeholder-then-switch step anymore.
- `useSyncedFloatingRootContext` (called from `src/utils/popups/popupStoreUtils.ts` and `MenuRoot.tsx`) never replaces the store. It derives `open`, `floatingId`, `referenceElement` and `floatingElement` from the popup store in one `createDepsMemo`, then binds each root field with `store.useSyncedValue`, so both stores change in the same flush. `domReferenceElement` updates only for element references; `positionReference` follows the reference unless set elsewhere.
- `useFloatingRootContext` (Select, Combobox, and standalone use) creates its own root once. `open` and `floatingId` are bindings; the elements and `onOpenChange` sync from one `createEffect` (`hooks/useFloatingRootContext.ts:73-99`) that also reads `props.open`, so reopening rewrites the elements, matching React writing them every render.

### Dynamic replacement (NavigationMenu)

`NavigationMenuRoot.tsx:116` derives `floatingRootContext` with a memo over the registered triggers' `{ active, context }` entries, returning the active trigger's root or `undefined`. React copies the context from the trigger's effect; Solid derives it in the same flush. Consumers fall back to `EMPTY_ROOT_CONTEXT` or a local context when it is `undefined`.

## Interactions

- Hooks take `{ context, props }` and read `props` lazily through getters, so handlers see current values. Their return objects expose `reference`, `floating`, `item` and `trigger` as getters that return `undefined` while `enabled` is `false`.
- `useInteractions(list)` builds one `lists` memo (`hooks/useInteractions.ts:36-62`) with no custom equality: any change re-creates all four arrays.
- Each getter (`getReferenceProps`, `getFloatingProps`, `getItemProps`, `getTriggerProps`) returns `merge(() => mergeProps([...], { callAllHandlers: true }))`, a live view. Call each getter once per part, not per render or per read.
- Select creates click, dismiss, list navigation and typeahead lazily through `useTriggerInteractions` on first intent, open, or mount (`SelectRoot.tsx:459`), and passes getter-backed `deferred(key)` entries to `useInteractions`.

## Hooks worth knowing

- `useListNavigation` (about 1,100 lines): returns a static `item` object and `enabled`-gated `reference`, `floating` and `trigger`. A navigation reaches the consumer's `activeIndex` at the next flush.
- `useTypeahead`: one `sharedProps = { onKeyDown, onFocusOut }` for reference and floating; React's bubbling `onBlur` maps to `focusout`.
- `FloatingFocusManager`: handles the Chrome/Firefox `focusout`-on-removal difference and coordinates with `FloatingPortal`, which restores tabbability before the queued focus-on-open step.
- The inside-portal mark (`dataRef.insidePortal`): a `focusout` inside a portaled floating element sets it, and a 0 ms timer clears it. It lives on the root, which outlives the popup, so `FloatingFocusManager` clears a pending mark when it unmounts. Otherwise an unmount that cancels the timer (Escape with focus on the popup, then the restore-to-popup return) leaves it set, and `useDismiss` drops the next session's first press-less outside click.
- `FloatingTree`: Solid contexts for node id and tree; `FloatingTreeStore` is a plain class with `nodesRef` and an emitter.

## Costs

- Per-hook memos over the same selectors: `createMemo(() => store().select(...))` appears 18 times in non-test files: `useRole` 4, `useDismiss` 4, `useListNavigation` 3, `FloatingFocusManager` 3, `useClientPoint` 3, `useTypeahead` 1. An open Select or Combobox popup holds several memos per selector (`open`, `floatingElement`, `domReferenceElement`) instead of one shared read.
- `getItemProps` fan-out: every item's live view depends on `lists()`. When any entry flips (for example typeahead `enabled`, which is `!disabled() && (open() || (!readOnly() && !multiple()))` at `SelectRoot.tsx:524`, so it toggles on open and close for multiple or read-only selects), all N `SelectItem` views (`SelectItem.tsx:162`) re-run `mergeProps`, although the item entries did not change.
- `merge` with a function source allocates a memo per view; see [primitive costs](../solid/primitive-costs.md).
- Benchmarks (CI run 38559281856, commit 27e77167, Solid rc.13): `select/preselected-800` open 3.8x React, `combobox/1000` open 3.7x, `menu/500` open 2.5x, `popover/roots-500` mount 4.2x, `tooltip/roots-500` mount 4.8x. Current numbers live in [baseline](../perf/baseline.md).

## When changing this layer

- Keep stable root identity outside NavigationMenu; update fields through `useSyncedValue` or `update`, never by swapping the store.
- Test against `packages/base-ui/packages/solid/test/floating-ui-tests` and the hook tests beside each file.
- Planned fixes (shared selectors, keyed list props, binding instead of effect sync) are ranked in the [optimization map](../perf/optimization-map.md).
