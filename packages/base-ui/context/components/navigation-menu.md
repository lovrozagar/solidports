---
tags: [navigation-menu, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/navigation-menu, packages/base-ui/packages/solid/src/navigation-menu/trigger/NavigationMenuTrigger.tsx, packages/base-ui/packages/solid/src/navigation-menu/root/NavigationMenuRoot.tsx, packages/base-ui/packages/solid/src/navigation-menu/navigationMenu.cost.test.tsx, packages/base-ui/packages/solid/test/floor/navigationMenu.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/navigation-menu/navigationMenu.parity.test.tsx, packages/base-ui/packages/solid/src/utils/native/compositeButton.ts, packages/base-ui/packages/solid/src/navigation-menu/trigger/NavigationMenuTrigger.pointerEvents.test.tsx]
verified: 2026-10-23
---

# Navigation menu

NavigationMenu is fully ported and is the costliest closed popup root; its triggers create their hover and click interactions on the first intent (D32), but each still builds a floating root context up front. Item, Icon and Link render natively with plain props (D32's sweep, unit A), and so does a plain Trigger on the client (unit B); Root, List, Content and the popup parts stay on the slow path.

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

Trigger, on the client only (`canRenderNative(props, ['nativeButton'])` with `nativeButton` true, as the other popup triggers): a `<button>` registered with its list's composite through `createNativeListItem`, `useButton` and `useCompositeItem` inlined. One `NativeNavigationMenuTriggerModel` per trigger is the target of module-level handlers: `useButton`'s gates for a focusable-when-disabled composite button (`aria-disabled`, no `disabled` attribute; Space clicks on keydown and its keyup is cancelled, `utils/native/compositeButton.ts`, shared with Tabs.Tab), then the consumer's handler, then the trigger's sources in the slow path's order (its own props, the list's dismiss props, hover, click), then the composite's focus highlight and hover focus. It writes `tabindex="0"`, the trigger identifier, `aria-expanded`, `aria-controls` while active, `aria-disabled`, `data-popup-open` and `data-pressed` while active, and `data-disabled`. The sizing effects, the hover state and the floating root context stay as on the slow path. Any `render`, a reactive `ref` or `nativeButton={false}` takes the slow path.

List keeps `CompositeRoot`'s JSX provider for its items' effect order (GOTCHA-019).

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root, one item (dev probe 2026-10-14, rc.13) | 227 |
| Closed-root budget, `closedRoot.cost.test.tsx` | 146 (before: 230, then 187, 182; 173 with the slow trigger) |

Per part, dev owner nodes one more copy adds (jsdom probe, 2026-10-23, before D32's units A and B; `navigationMenu.cost.test.tsx` after them, against `test/floor/navigationMenu.tsx`):

| Part | Before | After | Floor |
| :--- | ---: | ---: | ---: |
| Root, alone | 37 | 37 | – |
| List, in a root | 52 | 52 | – |
| Item | 12 | 2 | 3 |
| Trigger, in an item | 54 | 27 | 4 |
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

- Hover and click are created by `useTriggerInteractions` on the trigger's first intent or once its item is active (`trigger/NavigationMenuTrigger.tsx`); the slow path merges them into its reference props there, the native path dispatches to each. Until then the slow path's `getReferenceProps` passes the props through.
- A native trigger costs 27 nodes against the floor's 4 (jsdom, each owner one more trigger adds traced to its call site, 2026-10-23): the component 1, the element's attribute effect 1, the `isActiveItem` memo 1; the popup sizing machinery 12 (the `open` and `mounted` reset effects 1 each, and five deps effects at 2 each: the inactive-item cancel, the popup's ResizeObserver, the window resize listener, the content's MutationObserver and the open-time size sync); the floating root context and hover state 6 (`useFloatingRootContext`'s 2 effects, the `open` effect that resets the hover state, the root's `registerTriggerFloatingContext` settle callback, and the 2-node effect that remembers the active trigger element); the intent deferral's 2 layout effects; and the focus-guard `Show` 4 (its component and 3 memos). Post-sweep leaf: the sizing effects and the focus guards serve only the active item, so one set on the root, or created on activation, would take those 16 nodes off each trigger (27 to 11, plus whatever the replacement costs per trigger); the floating root context needs the root to build it on activation, since the root derives the active trigger's context from the triggers' registered ones. That and a native Trigger on the server and while hydrating (beside the Root, List and Content leaves) are the remaining leaves after the sweep.
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo (`open` 6 times).

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Dynamic floating root context: `root/NavigationMenuRoot.tsx:111` derives the active trigger's floating context in the same flush from the triggers' registered contexts. React copies it from the trigger's effect. Its identity changes with the active trigger by design.
- `trigger/NavigationMenuTrigger.tsx:819`: `handleActivation` clears its toggle latch in a microtask; `:882` defers the pointer-events mutation the same way, as upstream does, and skips it once the trigger is disposed (otherwise a trigger unmounted in the hover's tick left the body with `pointer-events: none`; `trigger/NavigationMenuTrigger.pointerEvents.test.tsx`).
- `content/NavigationMenuContent.tsx:144`: `mounted` lags `open` by a flush, so an opening content also renders while `open` is true.
- Content and viewport map React's bubbling `onFocus`/`onBlur` to `focusin`/`focusout` (`content/NavigationMenuContent.tsx:117`, `viewport/NavigationMenuViewport.tsx:128`).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/navigation-menu/page.mdx`
