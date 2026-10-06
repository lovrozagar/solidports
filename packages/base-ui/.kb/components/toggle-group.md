# Toggle Group

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

- React (read-only): `packages/react/src/toggle-group/`
- Solid (target):    `packages/solid/src/toggle-group/`
- Parity tests:      `packages/solid/src/toggle-group/**/*.parity.test.tsx` (where present), `packages/solid/src/utils/native/toggles.cost.test.tsx`

## Parity notes

- **Native (plan 8 3.1):** the `<div role="group">` through `renderCompositeRoot` (inlined `CompositeRoot`: `useCompositeRoot` + context + `CompositeList`, `stopEventPropagation` true as the component's default, `enableHomeAndEndKeys`) or a plain group inside a Toolbar; `data-disabled`/`data-multiple`/`data-orientation` in one effect.

## Open issues

- `utils/useRenderElement.stableProps.test.tsx` asserts the part reads its props through `useRenderElement` (a precondition, not the behavior); a native part never does. Decision pending with the orchestrator (plan 8 journal, 3.1).
