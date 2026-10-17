---
tags: [switch, native, perf, forms]
sources: [packages/base-ui/packages/solid/src/switch, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx]
verified: 2026-10-16
---

# Switch

Switch.Root and Switch.Thumb render natively by default at 13 dev nodes against 57 on the slow path, and every interaction row beats React.

## Status

- 2 upstream test files, 3 Solid (adds `SwitchRoot.parity.test.tsx`, fast vs slow path parity). Titles 68 upstream, 76 Solid.
- The repo parity script reports 0 missing titles and no Switch exceptions.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/` |
| :--- | :--- |
| Switch.Root | `switch/root/SwitchRoot.tsx` (+ `SwitchRootContext.ts`) |
| Switch.Thumb | `switch/thumb/SwitchThumb.tsx` |
| State mapping | `switch/stateAttributesMapping.ts` |

## Native fast path

Yes. See [render pipeline](../architecture/render-pipeline.md).

- Root (`SwitchRoot.tsx:83-89`): `canRenderNative(props, ['nativeButton', 'inputRef'])` and a falsy `nativeButton`. `canRenderNative` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`) rejects the server, hydration, proxied props (any `{...props}` spread), a `render` key and a reactive `ref`.
- Thumb (`SwitchThumb.tsx:33`): plain `canRenderNative(props)`.
- The root renders a `<span role="switch">` plus a hidden `<input>`; the input's `click` carries the change, as on the slow path.

## Reactive cost

Dev probe 2026-10-14, rc.13 (Root + Thumb):

| Case | Nodes | µs per instance |
| :--- | ---: | ---: |
| Switch fast | 13 | 460 |
| Switch slow | 57 | 613 |

Budget (current): `packages/base-ui/packages/solid/src/utils/native/toggles.cost.test.tsx:98-108`, Root + Thumb ≤ 6 nodes beyond a hand-written switch.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `switch/raw-1000` mount | 16.8 | 12.6 | 0.75x |
| `switch/1000` mount | 55.1 | 33.3 | 0.60x |
| `switch/1000` click 1 | 2.0 | 0.9 | 0.45x |
| `switch/1000` click 100 | 62.9 | 19.6 | 0.31x |
| `switch/1000` unmount | 5.4 | 5.5 | 1.02x |

Heap after mount: `switch/1000` 7800 KB React vs 3417 KB Solid.

## Hot spots

- Wrappers that forward `{...props}` take the slow path (57 nodes) because `canRenderNative` rejects proxies (`native/index.ts:69-71`).

## Known issues and divergences

- Server render and hydration always take the slow path, so server HTML and hydration keys match upstream.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/switch/page.mdx`
