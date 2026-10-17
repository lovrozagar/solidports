---
tags: [popover, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/popover, packages/base-ui/packages/solid/src/utils/popups, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useFloatingRootContext.ts, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx]
verified: 2026-10-16
---

# Popover

Popover is fully ported; a closed root still builds its trigger's hover and click hooks up front, so many roots mount 4.6x slower than React. It has no native fast path.

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

No. No Popover file imports `utils/native`; every part renders through `useRenderElement` (see [render pipeline](../architecture/render-pipeline.md)).

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root (dev probe 2026-10-14, rc.13) | 91 |
| Open root (dev probe 2026-10-14, rc.13) | 365 |
| Closed-root budget, `closedRoot.cost.test.tsx:110` | 80 (before: 113) |

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

## Hot spots

- Eager trigger hooks: `trigger/PopoverTrigger.tsx:98` (`useHoverReferenceInteraction`) and `:125` (`useClick`) run for every closed root. Tooltip, PreviewCard, Select, Combobox and Menu already defer theirs to the first intent via `utils/popups/useInteractionIntent.ts`; Popover does not.
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo (`open` 6 times, for example `hooks/useDismiss.ts:190`).
- `floating-ui-solid/hooks/useFloatingRootContext.ts:73` syncs element props into the store through an effect that re-runs on every `open` change.

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- `root/PopoverRoot.tsx:128`: `<FloatingTree>` wraps the component's output, not the component.
- `root/PopoverRoot.tsx:139`: the patient-click timeout in the store context is disposed with the root's owner.
- `root/PopoverRoot.tsx:58`: callbacks read the latest props when invoked.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/popover/page.mdx`
