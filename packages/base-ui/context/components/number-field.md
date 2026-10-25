---
tags: [number-field, native, forms, perf]
sources: [packages/base-ui/packages/solid/src/number-field, packages/base-ui/packages/solid/src/number-field/root/NumberFieldRoot.tsx, packages/base-ui/packages/solid/src/number-field/root/useNumberFieldStepperButton.tsx, packages/base-ui/packages/solid/src/number-field/input/NumberFieldInput.tsx, packages/base-ui/packages/solid/src/number-field/scrub-area/NumberFieldScrubArea.tsx, packages/base-ui/packages/solid/test/floor/numberField.tsx]
verified: 2026-10-25
---

# Number field

NumberField is fully ported. With plain props, Root, ScrubArea, Group, Input, Increment and Decrement render natively (D32): the six parts cost 40 dev nodes against 142 on the slow path, and mounting number-field/100 keeps 4.0 MB against React's 4.2 MB.

## Native fast path

`canRenderNative` picks the path once per part; the value, validation and scrubbing logic stays shared with the slow path.

- Root (`root/NumberFieldRoot.tsx`): a `<div>` with the field's state attributes. It keeps its JSX provider (GOTCHA-019), so the native element is built inside the provider's children, where the slow path's element resolves, and once (GOTCHA-020). The native path reads its props directly; only the slow path splits them into views.
- ScrubArea (`scrub-area/NumberFieldScrubArea.tsx`): a `<span role="presentation">` with its style and pointerdown handler, its context through `provideNativeContext`.
- Group (`group/NumberFieldGroup.tsx`): a `<div role="group">`.
- Input (`input/NumberFieldInput.tsx`): an `<input>` with the field's attributes, `prop:value`, the validation source's `aria-invalid` and `aria-describedby` over the consumer's, and its five handlers. On the server and while hydrating too (D33 batch 4a-1): the server prints the formatted value as the `value` attribute (`serverFormState`), which the hydrating client releases, keeping it as the property. One more hydrated field (Root and Input) creates 21 reactive nodes against 54 with the input on the slow path (exact, `test/hydration/number-field.hydration.test.tsx`).
- Increment and Decrement (`root/useNumberFieldStepperButton.tsx`): a `<button>` with `useButton`'s gates for a native button focusable while disabled inlined: `aria-disabled` while disabled or read-only, clicks and pointerdowns canceled then, keys other than Tab prevented, and the press-and-hold handlers. A stepper with `nativeButton={false}` keeps the slow path.

ScrubAreaCursor, rendered only while scrubbing, stays on the slow path. All parts read one compiled state writer (`writeNumberFieldState`, `utils/stateAttributesMapping.ts`).

## Pointer lock

ScrubArea's pointerdown requests a pointer lock on the body and awaits it. Chromium can grant it after a quick click has already ended the scrub: the probe saw the request, then pointerup and click, then the grant. Nothing released a lock granted that late, so the user's pointer stayed locked (the cursor hidden) until Escape, and in the browser suite the leftover lock swallowed a later test's real click (CI run 39789387208). The scrub area now releases a lock granted after the scrub ended (`releases a pointer lock granted after the scrub ended`). Upstream `@base-ui/react` has the same race.

## Reactive cost

`numberField.cost.test.tsx` measures each part against the hand-written floor (`test/floor/numberField.tsx`, which renders the same DOM in jsdom). Dev nodes per part, each child measured inside a Root:

| Part | Slow path | Native | Floor |
| :--- | ---: | ---: | ---: |
| Root | 28 | 16 | 11 |
| ScrubArea | 19 | 8 | 3 |
| Group | 13 | 3 | 3 |
| Input | 28 | 5 | 4 |
| Increment | 27 | 4 | 6 |
| Decrement | 27 | 4 | 6 |

A native Root leaves some of its lazy memos to the first child that reads them, so each child measures about 2 nodes more than it does under a slow Root.

`numberField.parity.test.tsx` renders the field through both paths and compares the documents after stepping up to the max and back, typing, blurring, and turning read-only and disabled on and off. `utils/native/siblingToggle.test.tsx` holds every part's element beside a toggling sibling.

Chromium heap the bench step keeps (production builds, a heap snapshot after a full collection):

| Scenario | React | Solid before D32 | Solid, native parts |
| :--- | ---: | ---: | ---: |
| number-field/100 mount | 4,173 KB | 9,420 KB | 4,025 KB |

## Post-sweep leaves

- ScrubAreaCursor stays on the slow path.
- File an upstream issue for the late pointer lock (see Pointer lock): `@base-ui/react`'s ScrubArea has the same race.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/number-field/page.mdx`
