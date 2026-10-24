---
tags: [menu, native, floating, composite, perf]
sources: [packages/base-ui/packages/solid/src/menu, packages/base-ui/packages/solid/src/menu/root/MenuRoot.tsx, packages/base-ui/packages/solid/src/menu/item/MenuItem.tsx, packages/base-ui/packages/solid/src/menu/item/nativeMenuItem.tsx, packages/base-ui/packages/solid/src/menu/utils/nativeItemIndicator.tsx, packages/base-ui/packages/solid/src/menu/menu.parity.test.tsx, packages/base-ui/packages/solid/src/menu/submenu-trigger/nativeSubmenuTrigger.tsx, packages/base-ui/packages/solid/test/menuSubmenuParity.tsx, packages/base-ui/packages/solid/src/context-menu, packages/base-ui/packages/solid/src/menubar, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/menu/menu.cost.test.tsx, packages/base-ui/packages/solid/test/floor/menu.tsx]
verified: 2026-10-24
---

# Menu

Menu (with ContextMenu and Menubar) is fully ported; a plain menu's items (`Menu.Item`, `LinkItem`, `CheckboxItem` and `RadioItem` with their indicators, and `SubmenuTrigger`) render natively (D32), so opening menu/500 keeps 3.6 MB against React's 6.7 MB, while the other parts are still on the slow `useRenderElement` path.

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

`Menu.Item`, `Menu.LinkItem`, `Menu.CheckboxItem` and `Menu.RadioItem` with their indicators, and `Menu.SubmenuTrigger`, in a plain menu (the D32 sweep, after Select), in Menu, ContextMenu and Menubar alike, on the client. The other parts still render through `useRenderElement`. See [render pipeline](../architecture/render-pipeline.md).

- The item renders its `<div role="menuitem">` through the kit when its props are plain, `nativeButton` is not `true` and the menu has no filter (`isUnfilteredItem`). The native path lives in `item/nativeMenuItem.tsx`, shared by the item kinds: what a kind changes (its own keys, `role`, state keys, the `closeOnClick` default) is one frozen module-level `NativeMenuItemKind` the model references, with no per-item flags or closures. One `NativeMenuItemModel` per item is the target of the module-level handler tables and of the attribute write; `useMenuItem`, `useMenuItemCommonProps` and `useButton`'s composite gates are inlined in the slow path's `mergeProps` order (button gate, consumer, the root's list navigation, the item).
- CheckboxItem (`CHECKBOX_ITEM_KIND`): `role="menuitemcheckbox"`, `aria-checked`, `data-checked`/`data-unchecked` (`itemMapping`), `closeOnClick` false by default. Its `init` reads `checked`/`defaultChecked` through `useControlled` onto the model, and its click calls `onCheckedChange` and toggles unless the details are canceled; the model is the `MenuCheckboxItemContext` value its indicator reads. The gate checks for a filter with `useMenuFilterImpl()` without registering, since the slow path registers its item under the item's context.
- RadioItem (`RADIO_ITEM_KIND`): `role="menuitemradio"`, `aria-checked`, `closeOnClick` false by default. Its `init` puts the radio group on the model: the group's `disabled` joins the item's, `checked` reads the group's keyed `isChecked`, and the click calls the group's `setValue`. Checked, with its indicator: 14 nodes against 52 on the slow path (floor 13).
- LinkItem (`LINK_ITEM_KIND`): an `<a role="menuitem">` (`useButton` with `native: false` over a link): never disabled, the root's `disabled` included, its state only `highlighted`; Space clicks it, and Enter is left to the browser when it has an `href`. `closeOnClick` false by default. 2 nodes against 23 on the slow path (floor 5).
- SubmenuTrigger (`submenu-trigger/nativeSubmenuTrigger.tsx`): its logic (registration, the eager hover and click, the focus-guard listener, the dev warning) stays in `MenuSubmenuTrigger`; only the element is native, a `<div role="menuitem">` over one `NativeSubmenuTriggerModel`. Its handlers dispatch, below the consumer's, to its own focus and blur, the parent's list navigation, the submenu's `triggerProps`, hover, click, the item's hover activation and the item's common props, read when the event fires. Its write sets the submenu's `triggerProps` attributes (`aria-haspopup`, `aria-expanded`, dropped under VoiceOver for a keyboard-opened submenu) between the item's and its own (`aria-controls`, `tabindex`), so keys that come and go are removed with them. A filtered menu (the filter's visibility branch and its submenu root's key handler) keeps the slow path. A closed `SubmenuRoot` with its trigger: 104 nodes against 132 on the slow path (the floor trigger 5).
- CheckboxItemIndicator and RadioItemIndicator (`utils/nativeItemIndicator.tsx`): a `<span aria-hidden>` mounted while its item is checked or `keepMounted`, its transition created lazily on the first check (`createLazyTransitionStatus`, Checkbox.Indicator's contract). Checked, with its item: 15 nodes against 53 on the slow path (floor 13).
- Follow-up leaf: an item of a filtered menu (inside `Menu.FilterProvider`) keeps the slow path, with its visibility branch and filter children; a later unit ports it.

## Reactive cost

Dev probe 2026-10-14, rc.13: closed root with one item 136 nodes, open 490, each open `Menu.Item` 25.

Current closed-root budgets in `packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx`:

- Menu (Trigger + unopened popup + one item): ≤ 114, down from 189, then 120 (`:78`).
- ContextMenu (Trigger area + unopened popup + one item): ≤ 74, down from 153, then 80 (`:94`).
- Open `Menu.Item`: at most the hand-written floor item plus 25% (`menu.cost.test.tsx`, floor `test/floor/menu.tsx`): within 6 nodes against the floor's 5 (24 on the slow path).
- No open-root budget exists.
- Fan-out (`menuItem.fanout.test.tsx`, 30 and 300 items): a highlight move leaves the active index with 6 subscribers at both sizes (`isActive` is keyed). A radio choice leaves the group value with 1 subscriber: `Menu.RadioItem` reads the group's keyed `isChecked` membership (created on the first read), where each item compared against the value, at 60 for 30 items and 600 for 300.

## Benchmarks

Heap kept by menu/500's first open (local Chromium, production bundles, two full collections around the step, `zz-heapdiff`, 2026-10-22): React 6.7 MB and 233k objects; Solid 10.3 MB and 301k on the slow item path, 3.6 MB and 111k on the native one.

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
- `nativeMenuItem.tsx:114` (the slow path's `MenuItem.tsx` likewise): every item subscribes to `isActive`, a keyed selector, so after the first move a highlight move re-runs the old and the new item only.
- Floating hooks hold 18 `createMemo(() => store().select(...))` reads, 6 of them for `open`, duplicated per popup.

See [floating](../architecture/floating.md), [composite lists](../architecture/composite-lists.md), and the [optimization map](../perf/optimization-map.md).

## Docs

- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/menu/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/context-menu/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/menubar/page.mdx`
