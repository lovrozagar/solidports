# Button

## Status

| Aspect                          | Status               |
| :------------------------------ | :------------------- |
| Ported (`packages/solid/`)      | yes (Solid-native fast path + `useRenderElement` slow path) |
| Docs ported (`docs/solid/`)     | yes                  |
| Tests passing (jsdom)           | yes                  |
| Tests passing (chromium)        | yes                  |
| Last reviewed                   | 2026-10-06           |

## Topics covered

| Topic         | Concept                                                        | React                                            | Solid                                              |
| :------------ | :------------------------------------------------------------- | :----------------------------------------------- | :------------------------------------------------- |
| native parts  | —                                                              | [../react/render-element.md](../react/render-element.md) | [../solid/native-parts.md](../solid/native-parts.md) |
| state attrs   | [../concepts/state-attributes.md](../concepts/state-attributes.md) | —                                            | —                                                  |

## Parity note (plan 8, first native part)

What React does (`packages/react/src/button/Button.tsx`): `useButton({ disabled, focusableWhenDisabled, native })`
returns `getButtonProps` (merges `type`/`role`, `useFocusableWhenDisabled` props, and the five
handlers `onClick`/`onMouseDown`/`onKeyDown`/`onKeyUp`/`onPointerDown`, each calling the consumer's
handler from inside its own) and `buttonRef`; `useRenderElement('button', ...)` applies
`data-disabled` from the state, `className`/`style` (function forms get the state), the `render`
prop, and the refs.

How the Solid-native version matches it (`packages/solid/src/button/Button.tsx`):

- Fast path only for a native, non-composite button with no `render`, no spread props, a static
  `ref` and a static `nativeButton` (contract: `../solid/native-parts.md`); every other case renders
  through `useRenderElement` exactly as before (same `useButton`).
- Attributes: `type="button"` and `tabindex="0"` in the cloned template (assigned when the consumer
  sets either); `data-disabled` (`''`/absent), `aria-disabled` (`'true'`/`'false'`) only when
  `focusableWhenDisabled`, `disabled` otherwise (`true`/absent; React's `false` renders the same);
  consumer props override all of them, including explicit `undefined`; `class`/`style` resolved
  against `{ disabled }`. Literal inputs are written once; anything reactive shares one render
  effect through Solid's `assign` (the slow path's writer).
- Handlers: the consumer's handler runs behind the part's gate (`disabled` → `preventDefault` for
  click/pointerdown, dropped for mousedown/keyup, keydown keeps only Tab while disabled and
  focusable), read when the event fires, `preventBaseUIHandler` installed first. `useButton`'s
  after-consumer keyboard logic is a no-op for a native non-composite button, so nothing runs after.
  A button that can never be disabled (static `false`/absent) registers no gate at all; one that can
  registers shared module handlers bound with `[handler, props]`.
- Refs: consumer callback refs once with the element, object refs set; no part ref (the slow path's
  `buttonRef` only serves composite items and the dev `nativeButton` warning, both excluded here).
- Children: a literal string/number inserted directly; a getter through Solid's `insert`.
- Server and hydration: slow path (server HTML and hydration keys unchanged).
- Measured (`button/button-1000`, 10 runs interleaved): see the plan-8 journal.

## Source paths

- React (read-only): `packages/react/src/button/`
- Solid (target):    `packages/solid/src/button/`, `packages/solid/src/utils/native/`
- Docs (target):     `docs/solid/src/routes/(docs)/solid/components/button.mdx`
- Demos (target):    `docs/solid/src/demos/solid/button/`

## Open issues

- A lowercase-only `onclick` consumer prop: the slow path's handler lookup skips the part's
  camel-case gate (props view quirk); the native path keeps the gate.
