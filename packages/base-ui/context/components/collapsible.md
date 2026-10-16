---
tags: [collapsible, native, disclosure, perf]
sources: [packages/base-ui/packages/solid/src/collapsible, packages/base-ui/packages/solid/src/collapsible/panel/useCollapsiblePanel.ts, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx]
verified: 2026-10-16
---

# Collapsible

Collapsible renders all three parts natively when props are plain; the panel's measurement and transition machinery is created only when the panel first renders.

## Status

- Test parity: 3 upstream test files, 5 Solid files (adds `Collapsible.parity.test.tsx` and `root/CollapsibleRoot.hydration.test.tsx`); 52 upstream and 60 Solid `it`/`test` lines. The repo parity script reports 0 missing titles and no Collapsible exceptions.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/collapsible/` |
| :--- | :--- |
| Root | `root/CollapsibleRoot.tsx`, state in `root/useCollapsibleRoot.ts` |
| Trigger | `trigger/CollapsibleTrigger.tsx` |
| Panel | `panel/CollapsiblePanel.tsx`, machinery in `panel/useCollapsiblePanel.ts` |

## Native fast path

Yes, per part, chosen once at setup:

- Root (`CollapsibleRoot.tsx:25`) and Panel (`CollapsiblePanel.tsx:34`): `canRenderNative(props)` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`): client, not hydrating, no store proxy from `{...props}`, no `render`, static `ref`.
- Trigger (`CollapsibleTrigger.tsx:37-40`): the same plus a static `nativeButton` that resolves to `true`.

See [render pipeline](../architecture/render-pipeline.md) and [transitions](../architecture/transitions.md).

## Reactive cost

Dev probe 2026-10-14, rc.13 (Root + Trigger + Panel):

| State | Fast nodes | Slow nodes | Fast µs | Slow µs |
| :--- | ---: | ---: | ---: | ---: |
| Closed | 12 | 47 | 41 | 214 |
| Open | 18 | 73 | 376 | 498 |

Budgets (current): `packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx:56-61` closed ≤ 12 (production 7); `:78-82` open ≤ 18 (production 11).

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. `raw-*` rows are hand-written disclosures in each framework.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `collapsible/300` mount | 8.9 | 7.1 | 0.80x |
| `collapsible/300` open all | 24.6 | 27.7 | 1.13x |
| `collapsible/300` close all | 24.6 | 19.6 | 0.80x |
| `collapsible/300-uncontrolled` click 100 | 89.2 | 59.9 | 0.67x |
| `collapsible/raw-300` mount | 2.2 | 3.7 | 1.68x |
| `collapsible/raw-300` close all | 2.0 | 3.2 | 1.60x |

Heap after mount (`collapsible/300`): 3100 KB React vs 1712 KB Solid.

## Hot spots

- First open is the expensive step: the panel creates its measurement machinery on first render (`CollapsiblePanel.tsx:204`), reads computed styles for the animation type (`useCollapsiblePanel.ts:624`) and forces style flushes (`:610`). `open all` script time is 11.2 ms Solid vs 0.6 ms React in the run above.
- The hand-written Solid baseline is also slower than hand-written React at mount and close.

## Known issues and divergences

- The panel writes its size CSS variables once the flush settles (`onSettled`, `useCollapsiblePanel.ts:53`), so many panels opening together share one layout, as React's batched state does.
- Accordion reuses this machinery; see [Accordion](accordion.md).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/collapsible/page.mdx`
