---
tags: [navigation-menu, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/navigation-menu, packages/base-ui/packages/solid/src/navigation-menu/trigger/NavigationMenuTrigger.tsx, packages/base-ui/packages/solid/src/navigation-menu/root/NavigationMenuRoot.tsx, packages/base-ui/packages/solid/src/navigation-menu/navigationMenu.cost.test.tsx, packages/base-ui/packages/solid/test/floor/navigationMenu.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-23
---

# Navigation menu

NavigationMenu is fully ported and is the costliest closed popup root; its triggers create their hover and click interactions on the first intent (D32), but each still builds a floating root context up front. Item, Icon and Link render natively with plain props (D32's sweep, unit A); Root, List, Trigger and the popup parts stay on the slow path.

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

Item, Icon and Link, on the client, the server and while hydrating (`canRenderNative(props, undefined, true)`):

- Item: a plain `<li>` that provides its value through `provideNativeContext`; a static `value` is read once, and the generated fallback id is taken either way, so hydration ids stay aligned with the slow path.
- Icon: a `<span aria-hidden>` with its open state (`data-popup-open`) and the default `▼` unless the consumer passes children.
- Link: an `<a>` registered with the content's composite list through `createNativeListItem`, `useCompositeItem` inlined: the composite's focus highlight and hover focus, the link's blur-out close and `closeOnClick`, `aria-current="page"` and `data-active` while active. A static `render` in the tag, config or function form stays native (`isNativeRender`); a member expression compiles to a getter and takes the slow path.

Trigger (it renders through `CompositeItem`, with its floating context) is the sweep's unit B; List keeps `CompositeRoot`'s JSX provider for its items' effect order (GOTCHA-019).

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root, one item (dev probe 2026-10-14, rc.13) | 227 |
| Closed-root budget, `closedRoot.cost.test.tsx` | 182 (before: 230, then 187) |

Per part, dev owner nodes one more copy adds (jsdom probe, 2026-10-23, before D32's unit A; `navigationMenu.cost.test.tsx` after it, against `test/floor/navigationMenu.tsx`):

| Part | Before | After | Floor |
| :--- | ---: | ---: | ---: |
| Root, alone | 37 | 37 | – |
| List, in a root | 52 | 52 | – |
| Item | 12 | 2 | 3 |
| Trigger, in an item | 55 | 55 | – |
| Icon, in a trigger | 11 | 3 | 3 |
| Content, closed, in an item | 19 | 19 | – |
| Link, in open content | 20 | 2 | 5 |

There is no open-root budget.

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

D32's deferred trigger interactions, local Chromium heap diff (`navigation-menu/8x100` mount, objects kept, 2026-10-22): React 1,185 KB; Solid before 1,365 KB, after 1,194 KB (53k to 49k objects).

D32's native Item, Icon and Link (unit A), local Linux Chromium `bench:component navigation-menu --compare` against f1b90217, `--runs 5`, 2026-10-23 (React, before, after):

| Step | Metric | React | Before | After |
| :--- | :--- | ---: | ---: | ---: |
| mount | heap after mount | 436.8 KB | 435.6 KB | 388.9 KB |
| hover open | open budget | 1,016 KB | 1,987 KB | 892 KB |
| hover open | retained | 579 KB | 1,551 KB | 503 KB |
| keyboard into content | retained | 596 KB | 1,522 KB | 474 KB |
| hover open | script | 5.2 ms | 9.2 ms | 4.9 ms |
| move across 8 triggers | script | 24.3 ms | 39.7 ms | 21.7 ms |
| escape | sync | – | 1.10 ms | 1.40 ms (regressed, +0.3 ms; the Mac regate after the unit judges it) |

## Hot spots

- Hover, click and their merged reference props are created by `useTriggerInteractions` on the trigger's first intent or once its item is active (`trigger/NavigationMenuTrigger.tsx`); until then `getReferenceProps` passes the props through.
- Each trigger still creates a floating root context up front: the root derives the active trigger's context from the triggers' registered ones, so deferring it needs the root to build it on activation. That and a native trigger (it renders through `CompositeItem`) are the remaining leaves after the sweep.
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo (`open` 6 times).

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Dynamic floating root context: `root/NavigationMenuRoot.tsx:111` derives the active trigger's floating context in the same flush from the triggers' registered contexts. React copies it from the trigger's effect. Its identity changes with the active trigger by design.
- `trigger/NavigationMenuTrigger.tsx:612`: `handleActivation` clears its toggle latch in a microtask; `:675` defers the pointer-events mutation the same way, as upstream does.
- `content/NavigationMenuContent.tsx:144`: `mounted` lags `open` by a flush, so an opening content also renders while `open` is true.
- Content and viewport map React's bubbling `onFocus`/`onBlur` to `focusin`/`focusout` (`content/NavigationMenuContent.tsx:117`, `viewport/NavigationMenuViewport.tsx:128`).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/navigation-menu/page.mdx`
