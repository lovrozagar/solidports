# Accordion

## Status

| Aspect                          | Status                                  |
| :------------------------------ | :-------------------------------------- |
| Ported (`packages/solid/`)      | yes                                     |
| Docs ported (`docs/solid/`)  | yes                                     |
| Tests passing (jsdom)           | green on 2026-10-06 (plan 8, 3.2)   |
| Tests passing (chromium)        | green on 2026-10-06 (plan 8, 3.2)   |
| Last reviewed                   | 2026-10-06                              |

## Source paths

- React (read-only): `packages/react/src/accordion/`
- Solid (target):    `packages/solid/src/accordion/`
- Docs (target):     `docs/solid/src/routes/(docs)/solid/components/accordion.mdx`
- Demos (target):    `docs/solid/src/demos/solid/accordion/`

## Parity note (plan 8, native fast path)

What React does (`packages/react/src/accordion/`): the root keeps the open values (`useControlled`)
and a `CompositeList` of items; an item is a controlled `useCollapsibleRoot` whose `open` is its
membership in the root's value, registered as a list item (its index becomes `data-index`), with
trigger id registration; header `<h3>`; trigger = Collapsible's trigger plus `id`; panel =
Collapsible's panel plus `role="region"`, `aria-labelledby`, root-level `keepMounted`/`hiddenUntilFound`.

How the Solid-native version matches it: the same hooks and contexts; the item's collapsible root
reads `open` directly (`alwaysControlled`, the controlled mode without `useControlled`'s memo), the
list registration is `createNativeListItem` with an index guessed from creation order (the list's
flush confirms it), contexts sit on plain owners, the panel machinery is created on first render.
Rendering follows `../solid/native-parts.md` ("Disclosure batch"). Parity test:
`packages/solid/src/accordion/Accordion.parity.test.tsx`.

## Open issues

- none recorded
