---
tags: [field, fieldset, form, native, forms, perf]
sources: [packages/base-ui/packages/solid/src/field, packages/base-ui/packages/solid/src/fieldset, packages/base-ui/packages/solid/src/form/Form.tsx, packages/base-ui/packages/solid/src/field/root/FieldRoot.tsx, packages/base-ui/packages/solid/src/field/control/FieldControl.tsx, packages/base-ui/packages/solid/src/field/error/FieldError.tsx, packages/base-ui/packages/solid/test/floor/field.tsx]
verified: 2026-10-22
---

# Field, Fieldset and Form

Field, Fieldset and Form are fully ported. With plain props, Form, Fieldset.Root and Legend and Field.Root, Label, Control, Description and Error render natively (D32): a field in a fieldset in a form costs 62 dev nodes against 137 on the slow path, and mounting fieldset/300 keeps 2.6 MB against React's 3.2 MB.

## Native fast path

`canRenderNative` picks the path once per part. The parts' logic (validation, labelable ids, the field's state) stays shared with the slow path; the native path renders through the kit.

- Form (`form/Form.tsx`): a `<form novalidate>` with its submit handler. The form calls the consumer's `onSubmit` itself once its fields are valid, so its handler is a plain dispatcher rather than a `partHandler` (which would call the consumer's handler first).
- Fieldset.Root (`fieldset/root/FieldsetRoot.tsx`): a `<fieldset>` with its legend's id and `disabled`.
- Fieldset.Legend (`fieldset/legend/FieldsetLegend.tsx`): a `<div>` with its registered id; a static `id` needs no memo.
- Field.Root (`field/root/FieldRoot.tsx`): a `<div>` with the field's state attributes. `FieldRoot` passes its props to the inner part with `createComponent`, since a JSX spread would make them a proxy and take the slow path.
- Field.Label (`field/label/FieldLabel.tsx`): a `<label>` with `useLabel`'s id, `for` and handlers.
- Field.Description (`field/description/FieldDescription.tsx`): a `<p>` with its id.
- Field.Control (`field/control/FieldControl.tsx`): an `<input>` with the field's attributes, the validation source's `aria-describedby` and `aria-invalid` (own keys, merged with the consumer's) and its four handlers. Client renders only: see post-sweep leaves.
- Field.Error (`field/error/FieldError.tsx`): a valid field's error builds no message memos, element or transition machinery (`createLazyTransitionStatus`). Once mounted it builds its element once (GOTCHA-020): a second error appearing in the same field re-read the branch, replaced the element and cleared the close-complete ref, so the first error stuck in its ending style.

Field.Item and Field.Validity stay on the slow path.

## Reactive cost

`field.cost.test.tsx` measures each part against the hand-written floor (`test/floor/field.tsx`, which renders the same DOM). Dev nodes per part:

| Part | Slow path | Native | Floor |
| :--- | ---: | ---: | ---: |
| Form | 14 | 5 | 3 |
| Fieldset.Root | 13 | 3 | 10 |
| Fieldset.Legend | 11 | 4 | 3 |
| Field.Root | 26 | 16 | 9 |
| Field.Label | 13 | 6 | 4 |
| Field.Control | 34 | 14 | 3 |
| Field.Description | 11 | 4 | 3 |
| Field.Error (valid) | 15 | 10 | 6 |

The floor's Fieldset.Root counts its JSX context provider, which the native part replaces with `provideNativeContext`.

`field.parity.test.tsx` renders a form with a fieldset and a field through both paths and compares the documents after focusing, typing, blurring, a required value cleared, a custom error, submitting, and disabling the fieldset.

Chromium heap the bench step keeps (production builds, a heap snapshot after a full collection):

| Scenario | React | Solid before D32 | Solid, native parts |
| :--- | ---: | ---: | ---: |
| fieldset/300 mount | 3,210 KB | 6,309 KB | 2,629 KB |
| form/50-fields mount | 2,393 KB | 3,790 KB | 1,979 KB |
| field/uncontrolled-typing mount | 475 KB | 423 KB | 302 KB |

## Post-sweep leaves

- Field.Control renders on the slow path on the server and while hydrating. The server prints the value as the `value` attribute, and hydration keeps a control's form-state attributes (`value`, `checked`), which `useRenderElement` reconciles and the native kit does not: the kit's hydration check flagged `value` against the client's `defaultValue`. Teaching the kit those attributes would make a hydrated control native too.
- Field.Item and Field.Validity are still on the slow path.

## Known issues and divergences

- Before 47c4136f the slow Field.Error split its props with solid-1-compat's `splitProps`, so `render` reached its element as an attribute; it now uses `splitComponentProps` like the other parts.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/field/page.mdx`
