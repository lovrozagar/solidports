---
tags: [select, native, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/select, packages/base-ui/packages/solid/src/select/root/SelectRoot.tsx, packages/base-ui/packages/solid/src/select/item/SelectItem.tsx, packages/base-ui/packages/solid/src/select/select.cost.test.tsx, packages/base-ui/packages/solid/test/floor/select.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-22
---

# Select

Select is fully ported; its open items render natively (D32), so opening a 1000-item list keeps 9.3 MB against React's 12.6 MB, while the root, trigger and popup parts are still on the slow `useRenderElement` path.

## Status

- Test parity: 20 upstream test files, 21 Solid files (adds `root/SelectRoot.reactivity.test.tsx`); 321 upstream and 328 Solid `it`/`test` lines. The repo parity script reports 0 missing titles and no Select exceptions.

## Parts

All under `packages/base-ui/packages/solid/src/select/`.

| Part | Directory |
| :--- | :--- |
| Root, store | `root/`, `store.ts` |
| Trigger, Value, Icon, Label | `trigger/`, `value/`, `icon/`, `label/` |
| Portal, Positioner, Popup, Backdrop, Arrow | `portal/`, `positioner/`, `popup/`, `backdrop/`, `arrow/` |
| List, Item, ItemText, ItemIndicator | `list/`, `item/`, `item-text/`, `item-indicator/` |
| Group, GroupLabel, Separator | `group/`, `group-label/`, `separator/` |
| ScrollArrow, ScrollUpArrow, ScrollDownArrow | `scroll-arrow/`, `scroll-up-arrow/`, `scroll-down-arrow/` |

## Native fast path

`Select.Item`, `Select.ItemText` and `Select.ItemIndicator` (plan 3 leaf 5.6.0, the first family of the D32 sweep). The other parts still render through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

- `Select.Item` renders its `<div role="option">` through the kit when its props are plain and `nativeButton` is not `true`. One `NativeSelectItemModel` per item is the target of the module-level handler tables, of the attribute write and of `SelectItemContext`; `useButton`'s composite gates are inlined in the slow path's `mergeProps` order (button gate, consumer, item, list navigation).
- The root builds one `getItemProps()` view, on the first item's read and under the root's owner, and every item reads it at event time; before, each item built its own view.
- The values slot and the selected-index claim are one render effect that compares against the slot it last wrote, where the slow path keeps two memo-and-effect pairs.
- `createNativeListItem` takes the typeahead `label` and `textRef`.
- `Select.ItemText` renders a plain `<div>` with its text refs; `Select.ItemIndicator` mounts through the kit's conditional, with no `<Show>` memos.

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 121 nodes, open 436, each open `Select.Item` 29.

Current budgets:

- Open `Select.Item` with its `ItemText` and an unselected `ItemIndicator`: at most the hand-written floor item plus 25% (`select.cost.test.tsx`, floor `test/floor/select.tsx`); 10 nodes against the floor's 9 (42 on the slow path): the item's selection reads the root's keyed membership (`createKeyedSelector`, created on the first item's read), so a value change re-runs only the items that joined or left it (`selectItem.fanout.test.tsx`: the value's subscribers stay flat from 30 to 300 items). A custom `isItemEqualToValue` cannot be keyed, and each item then compares in a memo of its own. Object values without a comparer are keyed by identity.
- Closed root (Trigger + Value + unopened popup + one item): ≤ 108, down from 188 before deferring interactions, providing context on one owner and creating the transition machinery on the first open (`packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx:174`).
- `Select.Item` ≤ 23 (`packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx:66`).
- No open-root budget exists.

## Benchmarks

Open latency: the press opens the popup synchronously in the trigger's own `mousedown` handler (reason `trigger-press`), with nothing scheduled in between. With the native items a Playwright click can resolve before Chromium dispatches that mousedown (the open landed 8 ms after the click resolved, 11 ms sooner from the same mark than the slow path), so a test waits for the open content, not for the click.

Heap kept by select/1000's first open (local Chromium, production bundles, two full collections around the step, `zz-heapdiff`, 2026-10-22): React 12.6 MB and 405k objects; Solid 28.1 MB and 773k on the slow item path, 9.3 MB and 253k on the native one.

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync ms.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| select/1000 mount | 1.3 | 2.4 | 1.85x |
| select/1000 open | 52.2 | 107.7 | 2.06x |
| select/1000 nav x50 | 38.0 | 41.6 | 1.09x |
| select/1000 select by click | 77.4 | 22.3 | 0.29x |
| select/preselected-800 open | 42.0 | 127.0 | 3.02x |
| select/preselected-800 unmount | 3.0 | 13.7 | 4.57x |
| select/multiple-1000 open | 43.8 | 119.7 | 2.73x |
| select/multiple-1000 toggle 50 | 160.9 | 225.3 | 1.40x |
| select/full-1000 open/close x20 | 2367.8 | 1450.9 | 0.61x |

## Hot spots

- `SelectRoot.tsx:572` wires click, dismiss, list navigation and typeahead through `deferred(...)` views into one `useInteractions` call; the hooks are created on first intent (`useTriggerInteractions`, `SelectRoot.tsx:459`).
- `floating-ui-solid/hooks/useInteractions.ts:36`: the `lists` memo has no equality and rebuilds every list when any hook's props change. Each item's `getItemProps()` view (`SelectItem.tsx:162`) re-merges then, so a flip of typeahead `enabled` (`SelectRoot.tsx:523`, depends on `open()`) touches all N items.
- `SelectItem.tsx:63`: every item subscribes to `isActive` (`store.ts`, keyed on `activeIndex`), so after the first move a highlight move re-runs the old and the new item only. `isSelectedByFocus` stays a plain selector: it changes once per selection, and keyed it built a projection and a node per item on that change, which cost 0.8–0.9 ms per selection and paid back only after several (unit 49).
- `internals/composite/list/CompositeList.tsx:273` re-sorts all automatic items by document position on every registration batch.
- Floating hooks hold 18 `createMemo(() => store().select(...))` reads, 6 of them for `open`, duplicated per popup.

See [composite lists](../architecture/composite-lists.md), [floating](../architecture/floating.md), and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Interaction hooks mount on first intent rather than up front as in React; closed-state output is handlers only, so behavior matches.
- Typeahead and the rendered value label read each item's label from `Select.ItemText` when the list flushes, as React reads its `textRef`. Before plan 3 leaf 4.9 they got that text only because every item registered a second time once its ItemText attached; a single registration would have given them the whole item's text (indicator included). The second registration came within the same open, so no user saw the wrong label.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/select/page.mdx`.
