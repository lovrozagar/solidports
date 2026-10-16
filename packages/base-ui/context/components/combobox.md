---
tags: [combobox, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/combobox, packages/base-ui/packages/solid/src/combobox/root/AriaCombobox.tsx, packages/base-ui/packages/solid/src/combobox/item/ComboboxItem.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-16
---

# Combobox

Combobox is fully ported on the slow `useRenderElement` path; filtering and closing beat React by large margins, while open, clear and reopen with 1000 items cost 2–3x React.

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

No. No Combobox file imports `utils/native`; every part renders through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 146 nodes, open 459, each open `Combobox.Item` 27.

Current budgets:

- Closed root (Input + unopened popup + List with one item): ≤ 149, down from 210 before deferring interactions (`packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx:192`).
- No per-item or open-root budget exists.

## Benchmarks

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
- `ComboboxItem.tsx:81`: each item memoizes `store.select('isActive', index)`, so a highlight move re-evaluates N memos.
- `internals/composite/list/CompositeList.tsx:273` re-sorts all automatic items by document position on every registration batch, which mounting 1000 items at once pays in full.

See [composite lists](../architecture/composite-lists.md), [floating](../architecture/floating.md), and the [optimization map](../perf/optimization-map.md).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/combobox/page.mdx`.
