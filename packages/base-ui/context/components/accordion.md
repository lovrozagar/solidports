---
tags: [accordion, native, disclosure, perf]
sources: [packages/base-ui/packages/solid/src/accordion, packages/base-ui/packages/solid/src/collapsible/root/useCollapsibleRoot.ts, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx]
verified: 2026-10-16
---

# Accordion

Accordion items are controlled collapsibles registered as native list items; with plain props every part renders natively at 14 dev nodes per closed item versus 84 on the slow path.

## Status

- Test parity: 5 upstream test files, 6 Solid files (adds `Accordion.parity.test.tsx`); 40 upstream and 45 Solid `it`/`test` lines. The repo parity script reports 0 missing titles and no Accordion exceptions.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/accordion/` |
| :--- | :--- |
| Root | `root/AccordionRoot.tsx` |
| Item | `item/AccordionItem.tsx` |
| Header | `header/AccordionHeader.tsx` (`<h3>`) |
| Trigger | `trigger/AccordionTrigger.tsx` |
| Panel | `panel/AccordionPanel.tsx` |

## Native fast path

Yes, per part, chosen once at setup:

- Root (`AccordionRoot.tsx:44`), Item (`AccordionItem.tsx:36`), Header (`AccordionHeader.tsx:24`), Panel (`AccordionPanel.tsx:40`): `canRenderNative(props)` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`): client, not hydrating, no store proxy from `{...props}`, no `render`, static `ref`.
- Trigger (`AccordionTrigger.tsx:43-46`): the same plus a static `nativeButton` that resolves to `true`.

A native item registers through `createNativeListItem` with an index guessed from creation order (`AccordionItem.tsx:37`); the list's flush confirms it. Its collapsible root runs with `alwaysControlled: true` (`AccordionItem.tsx:110`), so `open` is read straight from root membership without `useControlled`. See [composite lists](../architecture/composite-lists.md) and [Collapsible](collapsible.md).

## Reactive cost

Dev probe 2026-10-14, rc.13, per closed item (Item + Header + Trigger + Panel): fast 14 nodes / 79 µs, slow 84 nodes / 459 µs.

Budget (current): `packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx:99-103` closed item ≤ 14 (production 10). No open-item budget exists.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. `raw-300` is a hand-written accordion in each framework.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `accordion/300` mount | 23.7 | 13.5 | 0.57x |
| `accordion/300` open one | 11.6 | 6.4 | 0.55x |
| `accordion/300` open all | 28.0 | 30.7 | 1.10x |
| `accordion/300` ArrowDown x50 | 2.2 | 1.5 | 0.68x |
| `accordion/300-animated` toggle x20 | 235.7 | 66.3 | 0.28x |
| `accordion/raw-300` mount | 3.0 | 4.5 | 1.50x |

Heap after mount (`accordion/300`): 5841 KB React vs 2569 KB Solid.

## Hot spots

- `open all` is the only step slower than React; it pays the panel's first-render machinery per item (`AccordionPanel.tsx:202`), the same cost as Collapsible's first open. Script time is 9.2 ms Solid vs 0.6 ms React.

## Known issues and divergences

- Contexts sit on plain owners and the panel machinery is created on first render; behavior matches upstream per `Accordion.parity.test.tsx`.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/accordion/page.mdx`
