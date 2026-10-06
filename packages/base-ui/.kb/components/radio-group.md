# Radio Group

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

- React (read-only): `packages/react/src/radio-group/`
- Solid (target):    `packages/solid/src/radio-group/`
- Parity tests:      `packages/solid/src/radio-group/**/*.parity.test.tsx` (where present), `packages/solid/src/utils/native/toggles.cost.test.tsx`

## Parity notes

- **Native (plan 8 3.1):** the `<div role="radiogroup">` through `renderCompositeRoot` (`modifierKeys` Shift, no Home/End) with the capture-phase keydown listener added directly, `onFocus`/`onBlur` after the consumer's, Field `data-*` and `aria-describedby`/`aria-invalid` in one effect.

## Open issues

- `utils/useRenderElement.stableProps.test.tsx` asserts the part reads its props through `useRenderElement` (a precondition, not the behavior); a native part never does. Decision pending with the orchestrator (plan 8 journal, 3.1).
