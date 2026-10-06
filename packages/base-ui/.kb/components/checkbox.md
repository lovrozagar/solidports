# Checkbox

## Status

| Aspect                          | Status     |
| :------------------------------ | :--------- |
| Ported (`packages/solid/`)      | yes        |
| Docs ported (`docs/solid/`)     | yes        |
| Tests passing (jsdom)           | yes        |
| Tests passing (chromium)        | yes        |
| Last reviewed                   | 2026-10-06 |

## Topics covered

| Topic        | Concept | React | Solid |
| :----------- | :------ | :---- | :---- |
| native parts | — | [../react/render-element.md](../react/render-element.md) | [../solid/native-parts.md](../solid/native-parts.md) |

## Source paths

- React (read-only): `packages/react/src/checkbox/`
- Solid (target):    `packages/solid/src/checkbox/`
- Parity tests:      `packages/solid/src/checkbox/**/*.parity.test.tsx` (where present), `packages/solid/src/utils/native/toggles.cost.test.tsx`

## Parity notes

- **Native (plan 8 3.1):** `Checkbox.Root` and `Checkbox.Indicator` render natively when `canRenderNative(props, ['nativeButton','parent','inputRef'])` and `nativeButton` is falsy. React: `useRenderElement` over `useButton` (non-native) + `rootProps` + field/description props, a hidden `<input>` through `mergeProps` + validation props, `useAriaLabelledBy`'s DOM label fallback. Solid-native: the `<span role="checkbox">` with literal attributes once and one render effect (aria-checked/data-checked/indeterminate, disabled/readOnly/required when they can change, Field state, `aria-describedby`/`aria-invalid` inside a Field); handlers as `[fn, model]` tuples in `mergeProps` order (button gate → consumer → part → `useButton` after-consumer); the hidden input with one render effect that also re-asserts `indeterminate`; label fallback from one user effect writing the attribute. Group registration (`registerChildId`, `disabledStates`), `registerInput`, `useValueChanged` only when their target exists.
- Recorded: `useValueChanged` is skipped outside a Field and a Form (all its calls are no-ops there).

## Open issues

- `utils/useRenderElement.stableProps.test.tsx` asserts the part reads its props through `useRenderElement` (a precondition, not the behavior); a native part never does. Decision pending with the orchestrator (plan 8 journal, 3.1).
