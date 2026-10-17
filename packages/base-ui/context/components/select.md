---
tags: [select, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/select, packages/base-ui/packages/solid/src/select/root/SelectRoot.tsx, packages/base-ui/packages/solid/src/select/item/SelectItem.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-17
---

# Select

Select is fully ported on the slow `useRenderElement` path; opening a 1000-item list costs about 2x React, while close and selection run 2–3x faster.

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

No. No Select file imports `utils/native`; every part renders through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 121 nodes, open 436, each open `Select.Item` 29.

Current budgets:

- Closed root (Trigger + Value + unopened popup + one item): ≤ 123, down from 188 before deferring interactions (`packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx:174`).
- `Select.Item` ≤ 27 (`packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx:66`).
- No open-root budget exists.

## Benchmarks

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
- `SelectItem.tsx:63`: every item subscribes to `isActive` (`store.ts`, keyed on `activeIndex`), so after the first move a highlight move re-runs the old and the new item only; `isSelectedByFocus` is keyed the same way.
- `internals/composite/list/CompositeList.tsx:273` re-sorts all automatic items by document position on every registration batch.
- Floating hooks hold 18 `createMemo(() => store().select(...))` reads, 6 of them for `open`, duplicated per popup.

See [composite lists](../architecture/composite-lists.md), [floating](../architecture/floating.md), and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Interaction hooks mount on first intent rather than up front as in React; closed-state output is handlers only, so behavior matches.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/select/page.mdx`.
