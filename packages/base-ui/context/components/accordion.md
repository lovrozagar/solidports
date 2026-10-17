---
tags: [accordion, native, disclosure, perf]
sources: [packages/base-ui/packages/solid/src/accordion, packages/base-ui/packages/solid/src/collapsible/root/useCollapsibleRoot.ts, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx]
verified: 2026-10-17
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

Yes, per part, chosen once at setup, on the client, the server and while hydrating:

- Root (`AccordionRoot.tsx:48`), Item (`AccordionItem.tsx:40`), Header (`AccordionHeader.tsx:28`), Panel (`AccordionPanel.tsx:41`): `canRenderNative(props, undefined, true)` (`packages/base-ui/packages/solid/src/utils/native/index.ts:69`): no store proxy from `{...props}`, no `render`, static `ref`.
- Trigger (`AccordionTrigger.tsx:52`): the same plus a static `nativeButton` that resolves to `true`.
- Contexts: transparent owners on the client, the provider on the server and its owners rebuilt while hydrating (D5, GOTCHA-017).

A native item registers through `createNativeListItem` with an index guessed from creation order; the list's flush confirms it, and corrects it when an item is added, removed or moved (`AccordionRoot.hydration.test.tsx`). Its collapsible root runs with `alwaysControlled: true`, so `open` is read straight from root membership. See [composite lists](../architecture/composite-lists.md) and [Collapsible](collapsible.md).

### Markup difference from upstream

The server renders each item's guessed index (`data-index="0"`, `"1"`, …) where upstream React renders `-1` until the client registers the items (D6). Both sides guess the same, so hydration claims every node, and no post-hydration write per item is needed. The docs hydration crawl does not compare attributes with React's, so it needs no known-difference entry.

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

- `open all` is the only step slower than React; it pays the panel's first-render machinery per item (`AccordionPanel.tsx:202`), the same cost as Collapsible's first open. Script time read 9.2 ms Solid vs 0.6 ms React, measured before 2026-10-17, when the bench's `script` left out each step's synchronous work (see [perf method](../perf/method.md)): re-measure before relying on it.

## Known issues and divergences

- Contexts sit on plain owners and the panel machinery is created on first render; behavior matches upstream per `Accordion.parity.test.tsx`. An item open since its panel was created defers the machinery to its first change, as Collapsible's panel does (D11).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/accordion/page.mdx`
