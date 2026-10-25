---
tags: [tabs, native, composite, perf]
sources: [packages/base-ui/packages/solid/src/tabs, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx]
verified: 2026-10-25
---

# Tabs

Tabs renders every part natively when props are plain, on the client, the server and while hydrating; a native tab costs 3 dev nodes versus 27 on the slow path, but each highlight change still touches every tab.

## Status

- Test parity: 5 upstream test files, 6 Solid files (adds `Tabs.parity.test.tsx`); 135 upstream and 142 Solid `it`/`test` lines. The repo parity script reports 0 missing titles and no Tabs exceptions.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/tabs/` |
| :--- | :--- |
| Root | `root/TabsRoot.tsx` |
| List | `list/TabsList.tsx` (composite root) |
| Tab | `tab/TabsTab.tsx` |
| Panel | `panel/TabsPanel.tsx` |
| Indicator | `indicator/TabsIndicator.tsx`, prehydration script in `indicator/prehydrationScript.template.js` |

## Native fast path

Yes, per part, chosen once at setup:

- Root (`TabsRoot.tsx:45`), List (`TabsList.tsx:123`), Panel (`TabsPanel.tsx:49`), Indicator (`TabsIndicator.tsx:180`): `canRenderNative(props, undefined, true)` (`packages/base-ui/packages/solid/src/utils/native/index.ts:82-112`): no store proxy from `{...props}`, no `render`, static `ref`, on the client, the server and while hydrating (D33 batch 4a-1). Each passes an element template (`{ tag, create }`), which the server renders as its tag.
- Tab (`TabsTab.tsx:52`): the same plus a static `nativeButton` that resolves to `true`.
- Hydration (`test/hydration/tabs.hydration.test.tsx`): every part keeps the server's element on its path with no mismatch, and props that force the slow path (a reactive `render`, a spread beside other props, a dynamic `nativeButton`, a getter `ref`) do so on both sides. The hydrated tabs register in a client render's order: the same roving tabindex, and ArrowRight moves focus the same way. One more tab and its panel cost 3 hydrate nodes against 46 on the slow path (exact).
- The Indicator's prehydration script positions the server's indicator and shows it; the spec names `style` and `hidden` as its `scriptedAttributes`, which the kit's development check of the server's markup skips. From the script through the settled tabs, the indicator is never hidden again and no position the script set goes missing or back to the server's, and it settles where the slow path settles, measured, not the script's rounded position.

The native list calls `useCompositeRoot` directly instead of rendering `CompositeRoot`. Tabs and panels register with `createNativeListItem` and an index guess (`TabsTab.tsx:333`, `TabsPanel.tsx:232`). `useButton`'s composite keyboard logic is inlined in `TabsTab.tsx`. See [composite lists](../architecture/composite-lists.md).

## Reactive cost

Dev probe 2026-10-14, rc.13, per tab: fast 3 nodes / 42 µs, slow 27 nodes / 161 µs.

Budget (current): `packages/base-ui/packages/solid/src/utils/native/disclosure.cost.test.tsx:122-125` a Tab plus its hidden Panel ≤ 4 nodes. A hidden panel creates its machinery on first render, so no open-panel budget exists.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. `raw-200` is hand-written tabs in each framework.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `tabs/200` mount | 12.3 | 10.1 | 0.82x |
| `tabs/200` switch tab | 9.2 | 3.5 | 0.38x |
| `tabs/200` arrow x50 | 133.1 | 49.2 | 0.37x |
| `tabs/200-keepmounted` mount | 14.4 | 15.3 | 1.06x |
| `tabs/200-vertical` click tab 150 | 10.2 | 3.7 | 0.36x |
| `tabs/raw-200` mount | 1.6 | 2.1 | 1.31x |

Heap after mount (`tabs/200`): 2666 KB React vs 1162 KB Solid.

## Hot spots

- Each arrow key is O(n): every native tab derives `isHighlighted` from the shared `highlightedIndex()` (`TabsTab.tsx:338`) and writes `tabindex` from it (`:541`), and its highlight-sync effect also reads `highlightedIndex()` (`:362-372`). A keyed selector would touch two tabs.
- `keepMounted` mount is the one step slower than React: every panel builds its machinery up front.

## Known issues and divergences

- A hidden panel passes `animateInitialOpen` so its first open still enters `'starting'` (`TabsPanel.tsx:172`).
- The tab's highlight-sync effect compares its own dependency snapshot (`shallowEqual`) instead of React's dependency array.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/tabs/page.mdx`
