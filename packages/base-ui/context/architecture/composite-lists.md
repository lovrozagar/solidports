---
tags: [composite, lists, keyboard, perf]
sources: [packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/internals/composite/list/CompositeListContext.ts, packages/base-ui/packages/solid/src/internals/composite/list/useCompositeListItem.ts, packages/base-ui/packages/solid/src/internals/composite/item/useCompositeItem.ts, packages/base-ui/packages/solid/src/internals/composite/root/useCompositeRoot.ts, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/index.ts]
verified: 2026-10-18
---

# Composite lists

`CompositeList` turns item registrations into ordered `elements`/`labels` arrays and per-item indexes; every flush rebuilds the whole snapshot, and every highlight change re-evaluates each item's roving `tabindex`.

## Pieces

All paths are under `packages/base-ui/packages/solid/src/`.

| File | Role |
| --- | --- |
| `internals/composite/list/CompositeList.tsx` | Registration map, batched flush, sorted snapshot, `MutationObserver` reorder check |
| `internals/composite/list/CompositeListContext.ts` | `register` (with the item's index sink), `unregister`, `subscribeMapChange` (whole-map listeners), `nextIndexRef` |
| `internals/composite/list/useCompositeListItem.ts` | Slow-path item hook: registers a node, follows its index |
| `internals/composite/item/useCompositeItem.ts` | Adds roving focus: `onFocus`, hover highlight, `tabindex` |
| `internals/composite/root/useCompositeRoot.ts` | Keyboard navigation, `highlightedIndex` (controlled or internal signal) |
| `utils/native/listItem.ts` | `createNativeListItem`: native-kit registration (Accordion.Item, Tabs.Tab, Tabs.Panel) |
| `utils/native/index.ts` | `createCompositeItemRegistration` (Radio, Toggle) and `renderCompositeRoot` (RadioGroup, ToggleGroup) |

`CompositeList` is rendered by AccordionRoot, CompositeRoot, TabsRoot, MenuPositioner, SelectPositioner, ComboboxList, ComboboxChips, SliderRoot and OTPFieldRoot.

## Registration

- The list keeps `Map<Element, { owner, registration }[]>`. Nested items that share one DOM node each register with their own `owner` object; the first attached entry wins and later ones take over when it unregisters. React gets this from ref attachment order.
- A registration is `{ metadata, index, label, textRef }`. `index: null` means automatic (DOM order); a number reserves that slot. `textRef` is a reader the list calls when it builds labels, as React reads its ref object at flush: an ItemText part's ref attaches after the item registered, and a registered element value made every Select item register twice per open (two 1,000-item flushes).
- Items register from their ref (Solid applies refs once, never with `null`) and unregister in `onCleanup`. `useCompositeListItem` also runs one effect that re-registers when metadata, explicit index or label change, compared field by field against the last registration.
- Index guess: with `IndexGuessBehavior.GuessFromOrder` (or `guessIndex` in the native helpers), the initial index comes from `nextIndexRef` in creation order, so a flat list in DOM order needs no update after the first flush. The flush corrects a wrong guess.
- Each item registers an index sink (`{ current, set }`) with its registration; the list calls `set` only when a flush gives the item another index. Whole-map consumers (`MenuFilterList`) use `subscribeMapChange`.

## Flush

`register`/`unregister` call `scheduleMapUpdate`, which flips one signal per batch. A user effect on that signal (`CompositeList.tsx:202-206`) runs `flush` after the items' refs attached, matching React's parent layout effect running after child refs.

`flush` (`:169-198`) does, on every run:

1. `getCompositeListSnapshot` (`:246-290`): walks the whole map, skips disconnected nodes, sorts all automatic items by document position (`:273`), assigns indexes around reserved ones, and sorts again by index when any are reserved.
2. `syncRefs` (`:85-114`): empties and refills `refs.elements` and `refs.labels` in place, and builds a new `Map` with a spread copy of each item's metadata plus `index` (`:96-99`). Labels fall back to `textRef.textContent` or `element.textContent`, a DOM read per item.
3. Compares the new items with the previous ones; if unchanged, stops after re-arming the observer.
4. Calls the sink of each item whose index moved (an insertion updates the items after it; a flush that confirms every guessed index updates none), then every `subscribeMapChange` listener and `onMapChange` with a fresh array.

`sortByDocumentPosition` (`:316-329`) short-circuits adjacent siblings before falling back to `compareDocumentPosition`, which keeps sorting an already ordered flat list near linear.

The `MutationObserver` (`:116-167`) watches the common parents of adjacent sorted pairs and schedules a flush only when a node was moved (removed and re-added while connected) out of order.

## Highlight reads

- `useCompositeItem.ts:15`: `isHighlighted = () => context.highlightedIndex() === listItem.index()`.
- `useCompositeItem.ts:32-34`: the `tabindex` getter reads `isHighlighted()`. Every item's `tabindex` binding depends on `highlightedIndex`, so each arrow key re-evaluates N bindings to change two attributes.
- The native paths repeat the comparison: `TabsTab.tsx:338` and `RadioRoot.tsx:519`.
- `createSelector` in `src/solid-1-compat.ts:143` is a compatibility shim without key isolation, so swapping it in does not fix this. A keyed fix needs a projection; see [primitive costs](../solid/primitive-costs.md).
- The Select, Combobox and Menu stores declare `isActive` with `keyedSelector` (Select's `isSelectedByFocus`, which changes once per selection, stays plain), keyed by the item's reactive index ([store and state](store-and-state.md)): after the first move, a highlight move re-runs the old and the new item's readers only (`utils/store/SolidStoreV2.listHighlight.test.tsx`). Value selection (`isSelected`) compares through `isItemEqualToValue`, has no stable key and stays a plain selector.
- Choosing keyed or plain: declare a selector keyed when its current id moves many times in the store's life (a highlight: every arrow key and hover), and keep it plain when it changes about once per open (a selection by focus). A keyed selector builds its projection, and a node per reader, on the first change of its id, re-running every reader once through it; later changes re-run two readers. That pays back within one navigation, and not for a value that moves once: keyed, Select's `isSelectedByFocus` cost 0.8–0.9 ms per selection at 1,000 items (unit 49, fixed in 31a00661). Waiting for a second change before keying only moves the cost to the next selection (+1.2 ms on select item 500 by click, measured and dropped).

## Native list item

`createNativeListItem(metadata, { guessIndex })` covers items with an automatic index, no label and no `textRef`:

- One index signal and its sink instead of the hook's signal and registration effect.
- Static metadata is read once; an accessor gets one effect that re-registers on change.
- The list sees the same registrations in the same order, so slow and native items can share a list.
- `createCompositeItemRegistration` in `utils/native/index.ts:364` is a second helper with the same contract that always guesses the index. Radio and Toggle use it.

## Costs

- A flush is O(n log n) worst case over all items, not only the changed ones, plus one metadata copy per item; only items whose index moved are updated. Items that register across separate flushes (lazy or late mounting) pay that per batch, so k batches cost k full rebuilds.
- Highlight: O(n) binding re-evaluations per arrow key or hover highlight.
- Per slow item: one signal and one effect.
- Ranked fixes (keyed highlight, incremental insertion, native list items) are in the [optimization map](../perf/optimization-map.md).

## When changing this layer

- Keep registration order identical between slow and native items; mixed lists depend on it.
- `CompositeList.test.tsx` covers ordering, nesting and reorders; `CompositeList.ssr-fixtures.tsx` feeds the hydration suite (see [SSR and hydration](ssr-hydration.md)).
- Reactivity rules for effects and refs: [refs and events](../solid/refs-and-events.md).
