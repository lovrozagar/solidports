---
tags: [otp-field, native, forms, perf]
sources: [packages/base-ui/packages/solid/src/otp-field, packages/base-ui/packages/solid/src/otp-field/root/OTPFieldRoot.tsx, packages/base-ui/packages/solid/src/otp-field/input/OTPFieldInput.tsx, packages/base-ui/packages/solid/test/floor/otpField.tsx]
verified: 2026-10-22
---

# OTP field

OTPField is fully ported. With plain props on the client, Root and every Input render natively (D32): a slot costs 8 dev nodes against 36 on the slow path, and mounting otp-field/12 keeps 595 KB against React's 667 KB.

## Native fast path

`canRenderNative` picks the path once per part; the value, focus and paste logic stays shared with the slow path.

- Root (`root/OTPFieldRoot.tsx`): a `<div role="group">` with its labels. It is built inside the context provider (within the composite list), where the slow path's element resolves, and once (GOTCHA-020). The native path reads its props directly; only the slow path splits them into views. The hidden form input stays the root's own JSX.
- Input (`input/OTPFieldInput.tsx`): an `<input>` whose reactive attributes are written from the slot's props getters in one pass (`INPUT_ATTRIBUTE_KEYS`) and whose eight handlers forward to them.

The native path covers client renders only: the server prints each slot's character as its `value`, which the slow path renders and hydration keeps.

## Reactive cost

`otpField.cost.test.tsx` measures each part against the hand-written floor (`test/floor/otpField.tsx`, which renders the same DOM in jsdom). Dev nodes:

| Part | Slow path | Native | Floor |
| :--- | ---: | ---: | ---: |
| Root | 36 | 24 | 11 |
| Input (per slot) | 36 | 8 | 4 |

`otpField.parity.test.tsx` renders a four-slot field through both paths and compares the documents after typing, deleting, pasting a code, blurring, and turning disabled on and off. `utils/native/siblingToggle.test.tsx` holds every slot's element beside a toggling sibling. The provider effect-order case (`OTPField mount`, no extra runs) still holds.

Chromium heap the bench step keeps (production builds, a heap snapshot after a full collection):

| Scenario | React | Solid before D32 | Solid, native parts |
| :--- | ---: | ---: | ---: |
| otp-field/12 mount | 667 KB | 901 KB | 595 KB |

## Post-sweep leaves

- Server renders and hydration stay on the slow path (the slots' `value`).

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/otp-field/page.mdx`
