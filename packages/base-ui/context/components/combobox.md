---
tags: [combobox, native, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/combobox/chip/ComboboxChip.parity.test.tsx, packages/base-ui/packages/solid/test/hydration/combobox-row.hydration.test.tsx, packages/base-ui/packages/solid/src/utils/ItemIndicator.tsx, packages/base-ui/packages/solid/src/utils/native/itemIndicator.tsx, packages/base-ui/packages/solid/src/utils/ItemIndicator.parity.test.tsx, packages/base-ui/packages/solid/src/utils/ItemIndicator.cost.test.tsx, packages/base-ui/packages/solid/src/combobox, packages/base-ui/packages/solid/src/combobox/root/AriaCombobox.tsx, packages/base-ui/packages/solid/src/combobox/item/ComboboxItem.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/combobox/combobox.cost.test.tsx, packages/base-ui/packages/solid/test/floor/combobox.tsx]
verified: 2026-10-22
---

# Combobox

Combobox is fully ported; its listed items render natively (D32), so opening combobox/1000 keeps 5.7 MB against React's 9.3 MB, while the root, input and popup parts are still on the slow `useRenderElement` path.

## Status

- Test parity: 35 upstream test files, 36 Solid files (adds `root/AriaCombobox.test.tsx`); 715 upstream and 728 Solid `it`/`test` lines. The repo parity script reports 0 missing titles and no Combobox exceptions.

## Parts

All under `packages/base-ui/packages/solid/src/combobox/`. The shared engine is `root/AriaCombobox.tsx` (also used by Autocomplete).

| Part | Directory |
| :--- | :--- |
| Root, store | `root/`, `store.ts` |
| Input, InputGroup, Trigger, Clear, Icon, Label, Value | `input/`, `input-group/`, `trigger/`, `clear/`, `icon/`, `label/`, `value/` |
| Chips, Chip, ChipRemove | `chips/`, `chip/`, `chip-remove/` |
| Portal, Positioner, Popup, Backdrop, Arrow | `portal/`, `positioner/`, `popup/`, `backdrop/`, `arrow/` |
| List, Collection, Items, Row, Item, ItemIndicator | `list/`, `collection/`, `items/`, `row/`, `item/`, `item-indicator/` |
| Group, GroupLabel, Separator, Empty, Status | `group/`, `group-label/`, `separator/`, `empty/`, `status/` |

## Native fast path

`Combobox.Item` for a listed item (the D32 sweep, after Select and Menu), in Combobox and Autocomplete alike. The other parts still render through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

- The item renders its `<div role="option">` (`gridcell` in a row) through the kit when its props are plain, the list is not virtualized, it has no `index` prop and `nativeButton` is not `true`. One `NativeComboboxItemModel` per item is the target of the module-level handler tables, of the attribute write, of `ComboboxItemContext` and, as an `EventListener` object, of the capture-phase pointerdown; `useButton`'s composite gates are inlined in the slow path's `mergeProps` order (button gate, consumer, item, the root's list navigation).
- The visible-values slot and the selected-index claim are one render effect that compares against the slot it last wrote; a listed item needs no `listRef` slot (only a virtualized or indexed item writes one).
- `Combobox.ItemIndicator` renders natively on the client through the item indicator Select's shares (see [Select](select.md)): mounted while its item is selected or `keepMounted`. A mounted indicator costs 3 nodes against 24 on the slow path, an unselected one 1 against 6 (`utils/ItemIndicator.cost.test.tsx`). Any `render` takes the slow path.
- `Combobox.Row` renders a plain `<div role="row">` that tells its items they sit in a row (`gridcell`), on the client, the server and while hydrating: it takes no id and runs no effect. 3 nodes against 12 on the slow path (`combobox.cost.test.tsx`); a server-rendered inline grid list hydrates onto the server's rows and cells with no mismatch (`test/hydration/combobox-row.hydration.test.tsx`). Any `render` takes the slow path.
- `Combobox.Chip` renders a plain `<div tabindex="-1">` on the client, registered with the chips' composite list through `createNativeListItem`, over one `NativeComboboxChipModel` that its module-level keydown and attribute write target and that its remove button reads as the chip context (`index`). The keydown (`chipKeyDown`, shared with the slow path) runs below the consumer's: the arrows move between chips by direction and leave for the input at either end, Backspace and Delete remove the chip, Enter, Space and printable keys return to the input, and ArrowUp and ArrowDown open the list; a disabled or read-only combobox ignores them. It writes `aria-disabled`, `aria-readonly` and `data-disabled`. 6 nodes against 16 on the slow path (`combobox.cost.test.tsx`; `chip/ComboboxChip.parity.test.tsx`). Any `render` or a reactive `ref` takes the slow path.
- Follow-up leaf: a virtualized item and an item with an `index` prop keep the slow path.

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 146 nodes, open 459, each open `Combobox.Item` 27.

Current budgets:

- Closed root (Input + unopened popup + List with one item): ≤ 149, down from 210 before deferring interactions (`packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx:192`).
- Open `Combobox.Item`: at most the hand-written floor item plus 25% (`combobox.cost.test.tsx`, floor `test/floor/combobox.tsx`): within 6 nodes against the floor's 5 (25 on the slow path).
- No open-root budget exists.

## Benchmarks

Heap kept by combobox/1000's first open (local Chromium, production bundles, two full collections around the step, `zz-heapdiff`, 2026-10-22): React 9.3 MB and 326k objects; Solid 16.9 MB and 495k on the slow item path, 5.7 MB and 170k on the native one.

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync ms.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| combobox/1000 open | 31.6 | 69.4 | 2.20x |
| combobox/1000 clear | 29.8 | 69.8 | 2.34x |
| combobox/full-1000 type "item 5" | 104.0 | 18.4 | 0.18x |
| combobox/full-1000 clear | 18.0 | 59.7 | 3.32x |
| combobox/full-1000 reopen again | 24.6 | 80.9 | 3.29x |
| combobox/full-1000 replace items while open | 43.9 | 98.3 | 2.24x |
| combobox/full-1000 close by Escape | 19.2 | 1.3 | 0.07x |
| combobox/5000 mount | 2.0 | 8.5 | 4.25x |
| combobox/5000 open | 183.4 | 388.6 | 2.12x |
| combobox/5000 type "item 4" | 612.6 | 70.7 | 0.12x |
| combobox/5000 close | 126.7 | 1.2 | 0.01x |
| combobox/multiple-1000 open | 28.2 | 68.8 | 2.44x |

The slow steps all mount many items at once (open, clear back to the full list, reopen); filtering and closing only drop items.

## Hot spots

- `AriaCombobox.tsx:1715` defers click, dismiss and list navigation; `useInteractions` composes them at `:1721`, `:1727` and `:1751`.
- `floating-ui-solid/hooks/useInteractions.ts:36`: the `lists` memo has no equality, so every live props view built from it re-merges when any hook's props change.
- `ComboboxItem.tsx:81`: each item memoizes `store.select('isActive', index)`; `isActive` is a keyed selector, so after the first move a highlight move re-runs two of them.
- An item's selection reads the store context's keyed membership (`selectedMembership`, a `createKeyedSelector` over the selected value that the root creates on the first read, with objects keyed by identity), on the native and the slow path. So a selection change re-runs only the items that joined or left it: `comboboxItem.fanout.test.tsx` shows the value's subscribers at 7 (multiple) and 8 (single) at both 30 and 300 items, against one per item before (306 at 300; the 36 in 5132cb94's message was the 30-item count before the fix) (D32's batch 1 regate, combobox/multiple-1000 remove 10 chips 10.7 to 30.6 ms). A custom `isItemEqualToValue` compares in a per-item memo instead.
- `AriaCombobox.tsx` `hasItems` is a memo: each item reads it in two effects (`ComboboxItem.tsx`), and as a plain accessor over `items` it subscribed 2,000 item effects to the collection at 1,000 items (Solid's HUGE_FAN_OUT on `items`), so any new `items` array notified every item.
- `internals/composite/list/CompositeList.tsx:273` re-sorts all automatic items by document position on every registration batch, which mounting 1000 items at once pays in full.

See [composite lists](../architecture/composite-lists.md), [floating](../architecture/floating.md), and the [optimization map](../perf/optimization-map.md).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/combobox/page.mdx`.
