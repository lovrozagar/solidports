---
tags: [radio, native, composite, perf]
sources: [packages/base-ui/packages/solid/src/radio, packages/base-ui/packages/solid/src/radio-group, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx]
verified: 2026-10-16
---

# Radio and RadioGroup

Radio.Root, Radio.Indicator and RadioGroup render natively, registering with the group's composite list; interactions beat React, while mount sits at parity and each arrow key still notifies every radio.

## Status

- Radio: 2 upstream test files, 3 Solid (adds `RadioRoot.parity.test.tsx`). Titles 17 upstream, 28 Solid.
- RadioGroup: 1 file each, 86 upstream titles and 87 Solid.
- The repo parity script reports 0 missing titles and no exceptions for either family.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/` |
| :--- | :--- |
| Radio.Root | `radio/root/RadioRoot.tsx` (+ `RadioRootContext.ts`) |
| Radio.Indicator | `radio/indicator/RadioIndicator.tsx` |
| State mapping | `radio/utils/stateAttributesMapping.ts` |
| RadioGroup | `radio-group/RadioGroup.tsx` (+ `RadioGroupContext.ts`) |

## Native fast path

Yes. See [render pipeline](../architecture/render-pipeline.md) and [composite lists](../architecture/composite-lists.md).

- Root (`RadioRoot.tsx:87-93`): `canRenderNative(props, ['nativeButton', 'inputRef'])` and a falsy `nativeButton`. `canRenderNative` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`) rejects the server, hydration, proxied props, a `render` key and a reactive `ref`.
- Indicator (`RadioIndicator.tsx:36`) and RadioGroup (`RadioGroup.tsx:281`): plain `canRenderNative(props)`.
- The root renders `<span role="radio">` plus a hidden `<input type="radio">` and registers through `createNativeListItem` (`utils/native/listItem.ts`). The roving tab stop wins over the button's `tabindex` (`RadioRoot.tsx:512-521`).
- The group renders through `renderCompositeRoot` with Shift as the only modifier key and Home/End disabled (`RadioGroup.tsx:427-428`).

## Reactive cost

No dev probe row exists for Radio. Budget (current): `packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx:157-186`, Root + Indicator in a RadioGroup ≤ 18 nodes beyond a hand-written radio.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `radio/raw-300` mount | 5.3 | 4.5 | 0.85x |
| `radio/300` mount | 24.6 | 26.7 | 1.09x |
| `radio/300` click 100 | 909.9 | 367.2 | 0.40x |
| `radio/300` ArrowDown x50 | 764.2 | 204.6 | 0.27x |
| `radio/300` controlled value | 10.9 | 2.1 | 0.19x |
| `radio/300` unmount | 5.2 | 2.2 | 0.42x |

Heap after mount: `radio/300` 3716 KB React vs 2146 KB Solid.

## Hot spots

- Each native radio's attribute effect reads `highlightedIndex()` for its `tabindex` (`RadioRoot.tsx:519`), so one arrow key re-runs n effects. A keyed selector would make it O(1).
- `CompositeList.tsx:273` re-sorts every automatic item by document position on each registration batch.

## Known issues and divergences

- In a group the native path applies a function `style` with the part state, as React does; the slow path's `CompositeItem` drops it (`RadioRoot.parity.test.tsx:308`).
- Server render and hydration always take the slow path.

## Docs

- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/radio-group/page.mdx` (covers Radio; `components/radio/` holds only generated `types.md`)
