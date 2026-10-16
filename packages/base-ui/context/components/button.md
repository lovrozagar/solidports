---
tags: [button, native, perf]
sources: [packages/base-ui/packages/solid/src/button/Button.tsx, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/native.cost.test.tsx, packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx]
verified: 2026-10-16
---

# Button

Button is the reference native part: a plain `<button>` outside a composite root renders with direct JSX at 2 dev nodes; every other case falls back to `useRenderElement` at 11 or more.

## Status

- Test parity: 1 upstream test file and 1 Solid file (`Button.test.tsx`), 8 `it`/`test` titles each. The repo parity script reports 0 missing titles and no Button exceptions.

## Parts

| Part | File |
| :--- | :--- |
| Button | `packages/base-ui/packages/solid/src/button/Button.tsx` |
| Data attributes | `packages/base-ui/packages/solid/src/button/ButtonDataAttributes.ts` |

## Native fast path

Yes (`Button.tsx:40-46`). All of these must hold at setup:

- No composite root context (`useCompositeRootContext(true) == null`), so a Button inside a Toolbar or Menu takes the slow path.
- `canRenderNative(props, ['nativeButton'])` (`packages/base-ui/packages/solid/src/utils/native/index.ts:65-81`): not on the server, not hydrating, props not a Solid store proxy (any `{...props}` spread), no `render` key, a static `ref`, a static `nativeButton`.
- `nativeButton` resolves to `true`.

The native handler wrapper lowercases the key (`Button.tsx:106`), so `onclick` and `onClick` both run behind the disabled gate. See [render pipeline](../architecture/render-pipeline.md).

## Reactive cost

Dev probe 2026-10-14, rc.13:

| Case | Nodes | µs per instance |
| :--- | ---: | ---: |
| Plain `<button>` | 1 | 19 |
| Button fast | 2 | 25 |
| Button slow | 11 | 90 |
| Wrapper without spread | 6 | — |
| `{...{}}` spread at call site | 11 | — |
| Wrapper with `{...props}` | 15 | — |

Budgets (current):

- `packages/base-ui/packages/solid/src/utils/native/native.cost.test.tsx:58-60`: literal props ≤ 1 node beyond a plain `<button>`.
- `native.cost.test.tsx:63-68`: reactive children and props ≤ 3 (dev root, one attribute effect, one children insert).
- `packages/base-ui/packages/solid/src/utils/useRenderElement.cost.test.tsx:56-58`: ≤ 3 including the parent insert.

## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. `raw-*` rows are hand-written elements in each framework.

| Step | React sync ms | Solid sync ms | Ratio |
| :--- | ---: | ---: | ---: |
| `button/raw-1000` mount | 5.3 | 2.1 | 0.40x |
| `button/button-1000` mount | 12.8 | 4.7 | 0.37x |
| `button/button-1000` unmount | 2.9 | 1.3 | 0.45x |
| `static/button-nonnative-1000` mount | 10.7 | 33.2 | 3.10x |
| `static/button-render-fn-1000` mount | 10.0 | 41.1 | 4.11x |

Heap after mount: `button-1000` 2455 KB React vs 725 KB Solid; `button-nonnative-1000` 2756 KB vs 7859 KB.

## Hot spots

- The slow path mounts 3–4x slower than React. Wrappers that forward `{...props}` land there because `canRenderNative` rejects proxies (`native/index.ts:69-71`).

## Known issues and divergences

- No part ref on the native path: the slow path's `buttonRef` serves composite items and the dev `nativeButton` warning, both excluded from the native path.
- Server render and hydration always take the slow path, so server HTML and hydration keys match upstream.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/button/page.mdx`
