---
tags: [menu, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/menu, packages/base-ui/packages/solid/src/menu/root/MenuRoot.tsx, packages/base-ui/packages/solid/src/menu/item/MenuItem.tsx, packages/base-ui/packages/solid/src/context-menu, packages/base-ui/packages/solid/src/menubar, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-16
---

# Menu

Menu (with ContextMenu and Menubar) is fully ported on the slow `useRenderElement` path; mounting many roots and opening cost 2–3x React, while item actions and Escape are several times faster.

## Status

- Test parity: 37 upstream test files, 39 Solid files (adds `filter-root/MenuFilterItemIndicators.test.tsx` and `root/MenuRoot.stale-closure.test.tsx`); 512 upstream and 515 Solid `it`/`test` lines. ContextMenu: 3 files and 31 lines on both sides.
- The repo parity script reports 0 missing titles. One upstream test is not applicable: `menu/filter-root/MenuFilterRoot.test.tsx` "points aria-controls at the id of a server-created render element" (React Server Components only).

## Parts

All under `packages/base-ui/packages/solid/src/menu/`.

| Part | Directory |
| :--- | :--- |
| Root, store | `root/`, `store/` |
| Trigger, SubmenuRoot, SubmenuTrigger | `trigger/`, `submenu-root/`, `submenu-trigger/` |
| Portal, Positioner, Popup, Viewport, Backdrop, Arrow | `portal/`, `positioner/`, `popup/`, `viewport/`, `backdrop/`, `arrow/` |
| Item, LinkItem, List, Group, GroupLabel | `item/`, `link-item/`, `list/`, `group/`, `group-label/` |
| CheckboxItem (+ Indicator), RadioGroup, RadioItem (+ Indicator) | `checkbox-item/`, `checkbox-item-indicator/`, `radio-group/`, `radio-item/`, `radio-item-indicator/` |
| Filter parts | `filter-root/`, `filter-provider/`, `filter-submenu-root/`, `input/`, `empty/`, `clear/` |

ContextMenu lives in `context-menu/` (Root, Trigger, Positioner; the rest re-export Menu). Menubar is `menubar/Menubar.tsx`.

## Native fast path

No. No Menu, ContextMenu or Menubar file imports `utils/native`; every part renders through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 136 nodes, open 490, each open `Menu.Item` 25.

Current closed-root budgets in `packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx`:

- Menu (Trigger + unopened popup + one item): ≤ 142, down from 189 (`:78`).
- ContextMenu (Trigger area + unopened popup + one item): ≤ 103, down from 153 (`:94`).
- No open-root or per-item budget exists.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync ms.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| menu/500 open | 20.4 | 50.6 | 2.48x |
| menu/500 open by keyboard | 14.6 | 42.2 | 2.89x |
| menu/500 nav x50 | 33.1 | 36.3 | 1.10x |
| menu/500 click item | 29.4 | 4.1 | 0.14x |
| menu/checkbox-radio open | 12.2 | 41.0 | 3.36x |
| menu/checkbox-radio radio x50 | 261.2 | 76.5 | 0.29x |
| menu/many-roots-500 mount | 61.3 | 181.3 | 2.96x |
| menu/many-roots-500 unmount | 11.8 | 31.0 | 2.63x |
| context-menu/200 mount | 21.7 | 65.9 | 3.04x |
| menubar/10x50 mount | 2.6 | 5.5 | 2.12x |

## Hot spots

- `MenuRoot.tsx:644` `createInteractions()` builds dismiss, list navigation and typeahead on a trigger's first intent (`activateInteractions`, `:760`); React mounts them up front. The many-roots mount cost is the remaining per-root store, trigger and floating setup.
- `MenuRoot.tsx:783`, `:803`, `:820`: trigger and popup props are memos over `interactions()`, so they rebuild once when interactions activate.
- `MenuItem.tsx:53`: every item subscribes to `isActive`, so each highlight move re-evaluates N items.
- Floating hooks hold 18 `createMemo(() => store().select(...))` reads, 6 of them for `open`, duplicated per popup.

See [floating](../architecture/floating.md), [composite lists](../architecture/composite-lists.md), and the [optimization map](../perf/optimization-map.md).

## Docs

- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/menu/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/context-menu/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/menubar/page.mdx`
