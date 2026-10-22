---
tags: [popover, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/popover, packages/base-ui/packages/solid/src/utils/popups, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useFloatingRootContext.ts, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-22
---

# Popover

Popover is fully ported; a plain `Popover.Trigger` renders natively and builds its hover and click interactions on the first intent (D32), so a closed trigger costs 24 dev nodes against the slow trigger's 38 and a closed root's budget drops from 80 to 66.

## Status

- Test files: upstream 13, Solid 13. The test-parity script reports no missing upstream titles and no Popover exclusions.

## Parts

All under `packages/base-ui/packages/solid/src/popover/`.

| Part | File |
| :--- | :--- |
| Root | `root/PopoverRoot.tsx` |
| Trigger | `trigger/PopoverTrigger.tsx` |
| Portal, Positioner, Popup, Arrow, Backdrop, Viewport | `portal/`, `positioner/`, `popup/`, `arrow/`, `backdrop/`, `viewport/` |
| Title, Description, Close | `title/`, `description/`, `close/` |
| Store and detached handle | `store/PopoverStore.ts`, `store/PopoverHandle.ts` |

## Native fast path

`Popover.Trigger` with plain props renders through `renderNativeElement` (`trigger/PopoverTrigger.tsx`, `NativePopoverTriggerModel`); every other part renders through `useRenderElement` (see [render pipeline](../architecture/render-pipeline.md)).

- The element is created once; its attributes (id, `aria-expanded`, `aria-controls`, `disabled`, `data-popup-open`, `data-pressed`) are one grouped binding.
- Handlers are module-level `partHandler`s: `useButton`'s disabled gates, then the consumer's handler, then the trigger's sources in `mergeProps` order (interaction type, trigger props, hover, click), dispatched through `dispatch`.
- Hover and click interactions are created by `useTriggerInteractions` on the trigger's first intent (a pointer, mouse, key or focus event on it, from one capture listener per event type, `utils/popups/useInteractionIntent.ts`) or while the popup is open or mounted by this trigger. `PopoverTrigger.test.tsx` "two popovers on one page" guards both a click and a hover as the first intent on a second root.

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root (dev probe 2026-10-14, rc.13) | 91 |
| Open root (dev probe 2026-10-14, rc.13) | 365 |
| Closed-root budget, `closedRoot.cost.test.tsx:110` | 66 (before: 113, then 80) |
| Closed `Popover.Trigger`, `popover.cost.test.tsx` (floor `test/floor/popover.tsx`: 6) | 24 (slow path: 38) |

There is no open-root budget.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync time in ms.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| roots-500 mount | 32.2 | 149.2 | 4.63x |
| roots-500 unmount | 3.3 | 19.7 | 5.97x |
| content-200 mount | 0.5 | 1.7 | 3.40x |
| content-200 open by click | 3.9 | 5.0 | 1.28x |
| content-200 close by click | 2.2 | 2.1 | 0.95x |
| handle-20 switch triggers x20 | 50.3 | 54.0 | 1.07x |

Heap after mount: roots-500 uses 26322 KB versus React's 11294 KB.

D32's native trigger, local Chromium heap diff (`popover/roots-500` mount, objects kept, 2026-10-22): React 12,930 KB, Solid before 26,729 KB, after 20,033 KB (774k to 581k objects).

## Hot spots

- The closed trigger is 24 nodes against the floor's 6: the shared popup machinery (data forwarding, focus guards, the deferred-interaction listener) and the root's store remain. That gap is the exit bar's target after the sweep (D32).
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo (`open` 6 times, for example `hooks/useDismiss.ts:190`).
- `floating-ui-solid/hooks/useFloatingRootContext.ts:73` syncs element props into the store through an effect that re-runs on every `open` change.

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- `root/PopoverRoot.tsx:128`: `<FloatingTree>` wraps the component's output, not the component.
- `root/PopoverRoot.tsx:139`: the patient-click timeout in the store context is disposed with the root's owner.
- `root/PopoverRoot.tsx:58`: callbacks read the latest props when invoked.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/popover/page.mdx`
