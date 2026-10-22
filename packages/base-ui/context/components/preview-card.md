---
tags: [preview-card, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/preview-card, packages/base-ui/packages/solid/test/floor/previewCard.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/utils/native/popupParts.parity.test.tsx]
verified: 2026-10-22
---

# Preview card

PreviewCard is fully ported; a plain `PreviewCard.Trigger` renders natively (D32) and builds its hover and focus interactions on the first intent, so a closed trigger costs 12 dev nodes against the slow trigger's 23 and a closed root's budget drops to 44.

## Parts

All under `packages/base-ui/packages/solid/src/preview-card/`.

| Part | File |
| :--- | :--- |
| Root | `root/PreviewCardRoot.tsx` |
| Trigger | `trigger/PreviewCardTrigger.tsx` |
| Portal, Positioner, Popup, Arrow, Backdrop, Viewport | `portal/`, `positioner/`, `popup/`, `arrow/`, `backdrop/`, `viewport/` |
| Store and detached handle | `store/PreviewCardStore.ts`, `store/PreviewCardHandle.ts` |

## Native fast path

`PreviewCard.Trigger` without a detached `handle` renders through `renderNativeElement` (`trigger/PreviewCardTrigger.tsx`, `NativePreviewCardTriggerModel`); every other part renders through `useRenderElement` (see [render pipeline](../architecture/render-pipeline.md)).

- The `<a>` is created once; `id` and `data-popup-open` are one grouped binding, and the state writer writes no attribute of its own. The consumer's `href` and children pass through.
- Handlers are module-level `partHandler`s for every key a source can carry: the consumer's handler, then the sources in `mergeProps` order, the inline-rect handlers first (`getInlineRectTriggerProps`), then the root's trigger props (dismissal), focus and hover.
- `PreviewCardTrigger.test.tsx` "two preview cards on one page" guards a hover and a focus as the first intent on a second root; `popupParts.parity.test.tsx` compares the trigger closed and open with the slow path.

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed-root budget, `closedRoot.cost.test.tsx` | 44 (before: 99, then 69, 56, 55) |
| Closed `PreviewCard.Root` alone, `closedRoot.cost.test.tsx` (floor root: 9) | 27 (before: 39, then 28) |
| Closed `PreviewCard.Trigger`, `previewCard.cost.test.tsx` (floor `test/floor/previewCard.tsx`: 5) | 12 (slow path: 23) |

`trigger/PreviewCardTrigger.cost.test.tsx` pins the inline-rect props: built once, and the pointer recorded while the card is closed.

## Benchmarks

Local Chromium heap diff (`preview-card/roots-200` mount, objects kept, 2026-10-22): React 6,224 KB; Solid before the native trigger 7,326 KB, after 6,059 KB (222k to 191k objects), below React.
