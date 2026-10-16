---
tags: [tooltip, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/tooltip, packages/base-ui/packages/solid/src/utils/popups/useInteractionIntent.ts, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useFloatingRootContext.ts]
verified: 2026-10-16
---

# Tooltip

Tooltip is fully ported and defers its trigger interactions to the first intent, yet many closed roots still mount about 4x slower than React. It has no native fast path.

## Status

- Test files: upstream 9, Solid 10. The extra file is `root/TooltipRoot.stale-closure.test.tsx` (latest `onOpenChange` after a prop swap).
- The test-parity script reports no missing upstream titles and no Tooltip exclusions.

## Parts

All under `packages/base-ui/packages/solid/src/tooltip/`.

| Part | File |
| :--- | :--- |
| Provider | `provider/TooltipProvider.tsx` |
| Root | `root/TooltipRoot.tsx` |
| Trigger | `trigger/TooltipTrigger.tsx` |
| Portal, Positioner, Popup, Arrow, Viewport | `portal/`, `positioner/`, `popup/`, `arrow/`, `viewport/` |
| Store and detached handle | `store/TooltipStore.ts`, `store/TooltipHandle.ts` |

## Native fast path

No. No Tooltip file imports `utils/native`; every part renders through `useRenderElement` (see [render pipeline](../architecture/render-pipeline.md)).

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed root (dev probe 2026-10-14, rc.13) | 81 |
| Open root (dev probe 2026-10-14, rc.13) | 256 |
| Closed-root budget, `closedRoot.cost.test.tsx:64` | 83 (before deferral: 110) |

There is no open-root budget.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync time in ms.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| roots-500 mount | 23.9 | 92.3 | 3.86x |
| roots-500 hover across 50 | 159.7 | 130.9 | 0.82x |
| roots-500 unmount | 9.6 | 23.8 | 2.48x |
| handle-500 mount | 32.0 | 48.9 | 1.53x |
| handle-500 hover across 50 | 83.2 | 139.6 | 1.68x |
| handle-500 unmount | 50.1 | 8.5 | 0.17x |

Heap after mount: roots-500 uses 23993 KB versus React's 11218 KB; handle-500 uses 1781 KB versus 9910 KB.

## Hot spots

- First intent: `trigger/TooltipTrigger.tsx:226` creates hover and focus interactions through `useTriggerInteractions` (`utils/popups/useInteractionIntent.ts:114`). They exist up front only when this trigger opened or mounted the popup, or `trackCursorAxis` is not `'none'`.
- Floating store reads: `floating-ui-solid` hooks each wrap `store().select(...)` in their own memo. The key `open` is memoized 6 times and `floatingElement` and `domReferenceElement` 5 times each, for example `hooks/useDismiss.ts:190` and `hooks/useRole.ts:40`.
- `floating-ui-solid/hooks/useFloatingRootContext.ts:73` syncs element props into the store through an effect that also re-runs on every `open` change.

See [floating](../architecture/floating.md) and the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- `root/TooltipRoot.tsx:64`: callbacks read the latest props when invoked rather than closing over render-time values; the stale-closure test guards this.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/tooltip/page.mdx`
