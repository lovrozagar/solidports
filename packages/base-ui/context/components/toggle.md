---
tags: [toggle, native, composite, perf]
sources: [packages/base-ui/packages/solid/src/toggle, packages/base-ui/packages/solid/src/toggle-group, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx]
verified: 2026-10-16
---

# Toggle and ToggleGroup

Toggle renders a native `<button>` alone, in a ToggleGroup or in a Toolbar at 6 dev nodes against 27 on the slow path; ToggleGroup interactions run 4–20x faster than React.

## Status

- Toggle: 1 upstream test file, 2 Solid (adds `Toggle.parity.test.tsx`). Titles 7 upstream, 17 Solid.
- ToggleGroup: 1 file and 23 titles on each side.
- The repo parity script reports 0 missing titles and no exceptions for either family.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/` |
| :--- | :--- |
| Toggle | `toggle/Toggle.tsx` |
| ToggleGroup | `toggle-group/ToggleGroup.tsx` (+ `ToggleGroupContext.ts`) |

## Native fast path

Yes. See [render pipeline](../architecture/render-pipeline.md) and [composite lists](../architecture/composite-lists.md).

- Toggle (`Toggle.tsx:44-50`): `canRenderNative(props, ['nativeButton'])` and `nativeButton` (default `true`) is `true`. `canRenderNative` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`) rejects the server, hydration, proxied props (any `{...props}` spread), a `render` key and a reactive `ref`.
- Inside a composite root the native Toggle registers through `createNativeListItem` (`utils/native/listItem.ts`), activates on Space keydown (`Toggle.tsx:253-254`) and always sets `aria-disabled` (`Toggle.tsx:401`).
- ToggleGroup (`ToggleGroup.tsx:113`): plain `canRenderNative(props)`; renders through `renderCompositeRoot` with Home/End enabled (`ToggleGroup.tsx:192-193`), or as a plain group inside a Toolbar.

## Reactive cost

Dev probe 2026-10-14, rc.13: Toggle fast 6 nodes (23 µs), slow 27 nodes (63 µs).

Budgets (current), `packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx`:

- `:111-128`: Toggle ≤ 5 nodes beyond a hand-written toggle button.
- `:131-154`: Toggle in a ToggleGroup ≤ 5 nodes beyond a hand-written grouped toggle (controlled membership memo, list index signal, dev root).

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `toggle/raw-1000` mount | 4.6 | 4.3 | 0.93x |
| `toggle/1000` mount | 11.3 | 10.1 | 0.89x |
| `toggle/1000` click 100 | 43.3 | 17.2 | 0.40x |
| `toggle-group/raw-300` mount | 1.9 | 2.0 | 1.05x |
| `toggle-group/300-single` mount | 7.5 | 7.2 | 0.96x |
| `toggle-group/300-single` click 100 | 222.1 | 31.1 | 0.14x |
| `toggle-group/300-single` ArrowRight x50 | 112.9 | 27.0 | 0.24x |
| `toggle-group/300-multiple` controlled value | 2.1 | 0.3 | 0.14x |

Heap after mount: `toggle/1000` 3081 KB React vs 2266 KB Solid.

## Hot spots

- Each grouped Toggle's attribute effect reads `highlightedIndex()` for its `tabindex` (`Toggle.tsx:428`), so one arrow key re-runs n effects.
- `CompositeList.tsx:273` re-sorts every automatic item by document position on each registration batch.

## Known issues and divergences

- `Toggle.parity.test.tsx` pins identical DOM for both paths outside a group, including function `class` and `style`.
- Server render and hydration always take the slow path.

## Docs

- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/toggle/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/toggle-group/page.mdx`
