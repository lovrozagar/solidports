---
tags: [separator, progress, meter, native, perf]
sources: [packages/base-ui/packages/solid/src/separator/Separator.tsx, packages/base-ui/packages/solid/src/progress, packages/base-ui/packages/solid/src/meter, packages/base-ui/packages/solid/src/utils/native/static.cost.test.tsx, packages/base-ui/packages/solid/src/utils/native/staticParts.hydration.test.tsx]
verified: 2026-10-17
---

# Static parts

Separator and the Progress and Meter Tracks and Indicators render natively on the client, the server and while hydrating, at 1 dev node (2 with an attribute effect) against 11–15 on the slow path.

## Parts

| Part | File under `packages/base-ui/packages/solid/src/` | Native nodes (dev) | Slow nodes (dev) |
| :--- | :--- | ---: | ---: |
| Separator, literal orientation | `separator/Separator.tsx` | 1 | 13 |
| Separator, reactive orientation | `separator/Separator.tsx` | 2 | – |
| Progress.Track | `progress/track/ProgressTrack.tsx` | 2 | 14 |
| Progress.Indicator | `progress/indicator/ProgressIndicator.tsx` | 2 | 15 |
| Meter.Track | `meter/track/MeterTrack.tsx` | 1 | 11 |
| Meter.Indicator | `meter/indicator/MeterIndicator.tsx` | 2 | 12 |

Nodes beyond a plain `<div>` in the same position, without children (a child adds the insert). The native count is the dev component root plus the attribute effect, when anything can change; budgets in `utils/native/static.cost.test.tsx`, which `shared/manifest.ts` assigns to `separator`, `progress` and `meter`.

## Native fast path

`canRenderNative(props, undefined, true)`, then `renderNativeElement` from `utils/native/element.ts` with a `<div>` template. See [render pipeline](../architecture/render-pipeline.md).

- Separator: `role="separator"` is a literal, `aria-orientation` and `data-orientation` follow `orientation`. A literal (or absent) orientation creates no effect.
- Progress parts: the root's `status` state through `writeProgressState` (`progress/root/stateAttributesMapping.ts`, compiled once). The indicator's fill is a part style below the consumer's.
- Meter parts have no state attributes, and `class`/`style` functions receive an empty state, as on the slow path.
- An indeterminate Progress.Indicator writes no `style` attribute on either path. Upstream's empty style object renders no attribute in React; in Solid an empty object writes `style=""`, so the part style is `undefined` there.

## Guards

- `separator/Separator.parity.test.tsx`, `progress/Progress.parity.test.tsx`, `meter/Meter.parity.test.tsx`: the native and slow paths render the same DOM through every update, call handlers and apply refs the same way. In a real browser `toHaveStyle` reads computed (pixel) widths, so the fill checks read the inline style.
- `utils/native/staticParts.hydration.test.tsx` with `staticParts.ssr-fixtures.tsx`: each part claims the server's element natively and follows two updates as the client render does. The server prints a number as written (`inset-inline-start:0`) where the CSSOM reports `0px`, so styles are compared as the CSSOM reads them.

## Bench

Mac, Chromium, 8 runs, production builds, React / `main` 76d9425c / the port (2026-10-17):

| Scenario | Mount ms | Heap KB | Unmount ms |
| :--- | :--- | :--- | :--- |
| static/progress-meter-1000 | 13.7 / 92.2 / 59.8 (6.73x to 4.36x) | 1638 / 25239 / 14173 | 3.1 / 12.3 / 7.8 |
| static/separator-input-1000 | 11.5 / 43.2 / 32.7 (3.76x to 2.84x) | 2679 / 11054 / 7684 | 1.3 / 4.6 / 3.5 |

SSR, 10 runs, server ms / hydrate ms: progress/1000 38.2 / 27.5 React, 96.9 / 164.0 `main`, 47.4 / 101.4 the port; input/1000 8.8 / 18.1 React, 42.1 / 81.4 `main`, 33.4 / 63.5 the port. Server time is inside the rule's tolerance (high variance); hydrate improved beyond it. Updates were already below React and stay there (progress-meter 50 updates 0.76x). The Progress and Meter Roots, Avatar, Input and `useRender` remain on the slow path.
