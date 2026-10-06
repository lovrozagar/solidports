# Toggle

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

- React (read-only): `packages/react/src/toggle/`
- Solid (target):    `packages/solid/src/toggle/`
- Parity tests:      `packages/solid/src/toggle/**/*.parity.test.tsx` (where present), `packages/solid/src/utils/native/toggles.cost.test.tsx`

## Parity notes

- **Native (plan 8 3.1):** `Toggle` renders a direct `<button type="button">` when `nativeButton` is true: alone (Button-like gates), inside a composite root (Space activates on keydown, keyup prevented, `aria-disabled` always present) and inside a `ToggleGroup` (`createCompositeItemRegistration`: index guessed from render order, roving `tabindex`, `onFocus`/`onMouseMove` of `useCompositeItem` after the consumer's; Toolbar item metadata as a memo so a change re-registers).
- Recorded: inside a group the slow path (`CompositeItem` forwards `class` only) drops a function `style`; the native path applies it with the state as React does.

## Open issues

- `utils/useRenderElement.stableProps.test.tsx` asserts the part reads its props through `useRenderElement` (a precondition, not the behavior); a native part never does. Decision pending with the orchestrator (plan 8 journal, 3.1).
