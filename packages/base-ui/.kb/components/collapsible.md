# Collapsible

## Status

| Aspect                          | Status                                  |
| :------------------------------ | :-------------------------------------- |
| Ported (`packages/solid/`)      | yes                                     |
| Docs ported (`docs/solid/`)  | yes                                     |
| Tests passing (jsdom)           | unknown — re-run before relying on it   |
| Tests passing (chromium)        | unknown — re-run before relying on it   |
| Last reviewed                   | 2026-04-16                              |

## Topics covered

| Topic | Concept | React | Solid |
| :--- | :--- | :--- | :--- |
| collapsible-animation | [../concepts/collapsible-animation.md](../concepts/collapsible-animation.md) | [../react/collapsible-animation.md](../react/collapsible-animation.md) | [../solid/collapsible-animation.md](../solid/collapsible-animation.md) |
| transition-status-machine | [../concepts/transition-status-machine.md](../concepts/transition-status-machine.md) | covered in `react/collapsible-animation.md` | covered in `solid/collapsible-animation.md` |
| state-attributes | [../concepts/state-attributes.md](../concepts/state-attributes.md) | [../react/render-element.md](../react/render-element.md) (stub) | covered in `solid/collapsible-animation.md` |
| refs-and-controllers | n/a | [../react/refs-and-controllers.md](../react/refs-and-controllers.md) | [../solid/refs.md](../solid/refs.md) |

## Source paths

- React (read-only): `packages/react/src/collapsible/`
- Solid (target):    `packages/solid/src/collapsible/`
- Docs (target):     `docs/solid/src/routes/(docs)/solid/components/collapsible.mdx`
- Demos (target):    `docs/solid/src/demos/solid/collapsible/`

## Parity note (plan 8, native fast path)

What React does (`packages/react/src/collapsible/`): `useCollapsibleRoot` (controlled/uncontrolled
`open`, `useTransitionStatus`, panel id registration), the trigger through `useButton`
(focusable when disabled) with `aria-controls`/`aria-expanded`, the panel through
`useCollapsiblePanel` (animation type detection, measured sizes as CSS variables rendered from
state, `hidden`/`hidden="until-found"`, `beforematch`).

How the Solid-native version matches it: the same hooks; only the element rendering is native
(`../solid/native-parts.md`, "Disclosure batch"). The panel's measurement machinery is created on
first render and its CSS variables are written once the flush settles (one layout for many panels,
as React's batched state). The `render` prop, spread props, the server and hydration keep
`useRenderElement`. Parity test: `packages/solid/src/collapsible/Collapsible.parity.test.tsx`.

## Open issues

None recorded specifically for collapsible. Cross-cutting Solid gotchas
that may surface here are tracked in [`../solid/gotchas.md`](../solid/gotchas.md).

## Quick test

```bash
bun run test:solid:jsdom Collapsible --no-watch --reporter=agent
bun run test:solid:chromium Collapsible --no-watch --reporter=agent
```
