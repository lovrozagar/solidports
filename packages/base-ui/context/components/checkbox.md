---
tags: [checkbox, native, perf, forms]
sources: [packages/base-ui/packages/solid/src/checkbox, packages/base-ui/packages/solid/src/checkbox-group, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx, packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx]
verified: 2026-10-16
---

# Checkbox and CheckboxGroup

Checkbox.Root, Checkbox.Indicator and CheckboxGroup all have a native fast path; the default checkbox costs 20 dev nodes against 55 on the slow path and beats React on every interaction row.

## Status

- Checkbox: 3 upstream test files, 5 Solid (adds `CheckboxRoot.parity.test.tsx` for fast vs slow parity and `CheckboxRoot.pointer-event-shim.test.tsx` for jsdom). Titles 105 upstream, 116 Solid.
- CheckboxGroup: 2 files and 89 titles on each side.
- The repo parity script reports 0 missing titles and no exceptions for either family.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/` |
| :--- | :--- |
| Checkbox.Root | `checkbox/root/CheckboxRoot.tsx` (+ `CheckboxRootContext.ts`) |
| Checkbox.Indicator | `checkbox/indicator/CheckboxIndicator.tsx` |
| State mapping | `checkbox/utils/getCheckboxStateAttributesMapping.ts` |
| CheckboxGroup | `checkbox-group/CheckboxGroup.tsx` (+ `CheckboxGroupContext.ts`) |
| Parent checkbox logic | `checkbox-group/useCheckboxGroupParent.ts` |

## Native fast path

Yes. See [render pipeline](../architecture/render-pipeline.md).

- Root (`CheckboxRoot.tsx:92-98`): `canRenderNative(props, ['nativeButton', 'parent', 'inputRef'])` and a falsy `nativeButton`. `canRenderNative` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`) rejects the server, hydration, proxied props (any `{...props}` spread), a `render` key and a reactive `ref`.
- Indicator (`CheckboxIndicator.tsx:38`) and CheckboxGroup (`CheckboxGroup.tsx:197`, through `renderNativeElement`): plain `canRenderNative(props)`.
- The root renders a `<span role="checkbox">` plus a hidden `<input>`; one render effect on the input re-asserts `indeterminate`, since a native click resets it.

## Reactive cost

Dev probe 2026-10-14, rc.13 (Root + Indicator):

| Case | Nodes | µs per instance |
| :--- | ---: | ---: |
| Checkbox fast | 20 | 560 |
| Checkbox slow | 55 | 669 |
| Wrapper with `{...props}` | 58 | — |

Budgets (current):

- `packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx:80-95`: Root + Indicator ≤ 19 nodes beyond a hand-written checkbox.
- `packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx:61-63`: Checkbox.Root ≤ 10 nodes.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `checkbox/raw-1000` mount | 14.9 | 12.0 | 0.81x |
| `checkbox/uncontrolled-1000` mount | 93.9 | 48.8 | 0.52x |
| `checkbox/uncontrolled-1000` click 100 | 447.2 | 17.0 | 0.04x |
| `checkbox/uncontrolled-1000` space x50 | 313.9 | 219.2 | 0.70x |
| `checkbox/controlled-1000` toggle all | 101.3 | 43.1 | 0.43x |
| `checkbox/group-500-parent` parent all/none x10 | 526.6 | 253.8 | 0.48x |
| `checkbox/group-500-parent` unmount | 5.6 | 6.3 | 1.12x |

Heap after mount: `uncontrolled-1000` 9739 KB React vs 6295 KB Solid.

## Hot spots

- Design-system wrappers forwarding `{...props}` hit the slow path (58 nodes) because `canRenderNative` rejects proxies (`native/index.ts:69-71`).

## Known issues and divergences

- The native root skips `useValueChanged` outside a Field and a Form, where every call is a no-op (`CheckboxRoot.tsx:1076-1090`).
- `utils/useRenderElement.stableProps.test.tsx` counts native reads through `native/consumer` as well, so it covers both paths.

## Docs

- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/checkbox/page.mdx`
- `packages/base-ui/docs/solid/src/app/(docs)/solid/components/checkbox-group/page.mdx`
