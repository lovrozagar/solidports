---
tags: [slider, native, forms, perf]
sources: [packages/base-ui/packages/solid/src/slider, packages/base-ui/packages/solid/src/slider/root/SliderRoot.tsx, packages/base-ui/packages/solid/src/slider/control/SliderControl.tsx, packages/base-ui/packages/solid/src/slider/thumb/SliderThumb.tsx, packages/base-ui/packages/solid/src/slider/root/stateAttributesMapping.ts, packages/base-ui/packages/solid/test/floor/slider.tsx]
verified: 2026-10-22
---

# Slider

Slider is fully ported. With plain props on the client, Root, Label, Value, Control, Track, Indicator and Thumb render natively (D32): the seven parts cost 57 dev nodes against 185 on the slow path, and mounting slider/100 keeps 4.3 MB against React's 4.9 MB.

## Native fast path

`canRenderNative` picks the path once per part; the value, dragging and keyboard logic stays shared with the slow path. All parts read one compiled state writer (`writeSliderState`, `root/stateAttributesMapping.ts`).

- Root (`root/SliderRoot.tsx`): a `<div role="group">` with its id and labels; inside a Field, the field's validation source writes `aria-invalid` and `aria-describedby` over the consumer's. It is built inside the composite list's children, where the slow path's element resolves, and once (GOTCHA-020). The native path reads its props directly; only the slow path splits them into views.
- Label (`label/SliderLabel.tsx`): a `<div>` with the root-derived id and `useLabel`'s handlers; a consumer `id` is ignored, as on the slow path.
- Value (`value/SliderValue.tsx`): an `<output>` with `aria-live` (`off` by default) and `for` its thumbs' inputs.
- Control (`control/SliderControl.tsx`): a `<div>` with its pointerdown handler and refs.
- Track (`track/SliderTrack.tsx`): a `<div>` with `position: relative`.
- Indicator (`indicator/SliderIndicator.tsx`): a `<div>` with its position style.
- Thumb (`thumb/SliderThumb.tsx`): a `<div>` with its index, id and position style, owning its children (the consumer's, then its range input and, for the last inset thumb, the prehydration script).

The native path covers client renders only: while hydrating, the slider's prehydration script positions an inset slider's parts, and the slow path keeps that handoff.

## Reactive cost

`slider.cost.test.tsx` measures each part against the hand-written floor (`test/floor/slider.tsx`, which renders the same DOM in jsdom). Dev nodes per part, each child measured inside its parents:

| Part | Slow path | Native | Floor |
| :--- | ---: | ---: | ---: |
| Root | 37 | 18 | 9 |
| Label | 21 | 4 | 4 |
| Value | 24 | 6 | 4 |
| Control | 23 | 5 | 3 |
| Track | 20 | 2 | 4 |
| Indicator | 22 | 3 | 4 |
| Thumb | 38 | 19 | 6 |

The Thumb's remaining cost is its range input, which still spreads its props.

`slider.parity.test.tsx` renders the slider through both paths and compares the documents after focusing the thumb, stepping with the keyboard, jumping to the ends, blurring, and turning disabled on and off. `utils/native/siblingToggle.test.tsx` holds a range slider's elements beside a toggling sibling.

Chromium heap the bench step keeps (production builds, a heap snapshot after a full collection):

| Scenario | React | Solid before D32 | Solid, native parts |
| :--- | ---: | ---: | ---: |
| slider/100 mount | 4,929 KB | 8,936 KB | 4,319 KB |

## Post-sweep leaves

- Server renders and hydration stay on the slow path (the prehydration handoff).
- The Thumb's range input still spreads its props (`inputProps()`).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/slider/page.mdx`
