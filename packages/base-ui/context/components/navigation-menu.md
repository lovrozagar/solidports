---
tags: [navigation-menu, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/navigation-menu, packages/base-ui/packages/solid/src/navigation-menu/trigger/NavigationMenuTrigger.tsx, packages/base-ui/packages/solid/src/navigation-menu/root/NavigationMenuRoot.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-16
---

# Navigation menu

NavigationMenu is fully ported and is the costliest closed popup root (230-node budget) because its triggers are not deferred to the first intent. It has no native fast path.

## Status

- Test files: upstream 14, Solid 14. The test-parity script reports no missing upstream titles and no NavigationMenu exclusions.

## Parts

All under `packages/base-ui/packages/solid/src/navigation-menu/`.

| Part | File |
| :--- | :--- |
| Root | `root/NavigationMenuRoot.tsx` |
| List, Item, Link, Icon | `list/`, `item/`, `link/`, `icon/` |
| Trigger | `trigger/NavigationMenuTrigger.tsx` |
| Content | `content/NavigationMenuContent.tsx` |
| Portal, Positioner, Popup, Viewport, Arrow, Backdrop | `portal/`, `positioner/`, `popup/`, `viewport/`, `arrow/`, `backdrop/` |
| Positioning and sizing helpers | `utils/useNavigationMenuAnchorPositioning.ts`, `utils/setFixedSize.ts`, `utils/setSharedFixedSize.ts` |

## Native fast path

No. No NavigationMenu file imports `utils/native`.

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root, one item (dev probe 2026-10-14, rc.13) | 227 |
| Closed-root budget, `closedRoot.cost.test.tsx:211` | 230 |

The budget comment says it is not deferred: the trigger's hover and click hooks cost one node each. There is no open-root budget.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync time in ms, `navigation-menu/8x100`.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| mount | 1.7 | 5.2 | 3.06x |
| hover open | 25.0 | 24.7 | 0.99x |
| move across 8 triggers | 265.6 | 265.6 | 1.00x |
| escape | 2.5 | 1.9 | 0.76x |
| keyboard into content | 32.7 | 32.7 | 1.00x |
| link click | 2.5 | 1.4 | 0.56x |
| unmount | 2.5 | 4.1 | 1.64x |

Heap after mount: 472 KB versus React's 392 KB.

## Hot spots

- Eager trigger hooks: `trigger/NavigationMenuTrigger.tsx:496` creates a floating root context per trigger, and `:550` (`useHoverReferenceInteraction`) and `:578` (`useClick`) run for every closed trigger. Deferring them with `utils/popups/useInteractionIntent.ts` would lower mount cost.
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo (`open` 6 times).

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Dynamic floating root context: `root/NavigationMenuRoot.tsx:111` derives the active trigger's floating context in the same flush from the triggers' registered contexts. React copies it from the trigger's effect. Its identity changes with the active trigger by design.
- `trigger/NavigationMenuTrigger.tsx:612`: `handleActivation` clears its toggle latch in a microtask; `:675` defers the pointer-events mutation the same way, as upstream does.
- `content/NavigationMenuContent.tsx:144`: `mounted` lags `open` by a flush, so an opening content also renders while `open` is true.
- Content and viewport map React's bubbling `onFocus`/`onBlur` to `focusin`/`focusout` (`content/NavigationMenuContent.tsx:117`, `viewport/NavigationMenuViewport.tsx:128`).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/navigation-menu/page.mdx`
