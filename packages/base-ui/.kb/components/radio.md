# Radio

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

- React (read-only): `packages/react/src/radio/`
- Solid (target):    `packages/solid/src/radio/`
- Parity tests:      `packages/solid/src/radio/**/*.parity.test.tsx` (where present), `packages/solid/src/utils/native/toggles.cost.test.tsx`

## Parity notes

- **Native (plan 8 3.1):** `Radio.Root` (`<span role="radio">` + hidden `<input type="radio">`) and `Radio.Indicator`. In a `RadioGroup` the root registers with the group's composite list; the roving `tabindex` wins over the button's (the plan-7 tab-stop issue: `CompositeItem` ordered `baseProps` below `compositeProps`; the native path writes `tabindex` from the registration only). The hidden input registers with the group and the Field from the first attribute-effect apply (the group reads `checked`/`disabled` when it registers, as from the slow path's ref). Validation props only through the group (`groupContext.validation`), as the slow path.
- Recorded: a function `style` on a radio inside a group was dropped by the slow path (`CompositeItem`); native applies it (React behavior).

## Open issues

- `utils/useRenderElement.stableProps.test.tsx` asserts the part reads its props through `useRenderElement` (a precondition, not the behavior); a native part never does. Decision pending with the orchestrator (plan 8 journal, 3.1).
