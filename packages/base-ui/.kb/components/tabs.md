# Tabs

## Status

| Aspect                          | Status                                  |
| :------------------------------ | :-------------------------------------- |
| Ported (`packages/solid/`)      | yes                                     |
| Docs ported (`docs/solid/`)  | yes                                     |
| Tests passing (jsdom)           | green on 2026-10-06 (plan 8, 3.2)   |
| Tests passing (chromium)        | green on 2026-10-06 (plan 8, 3.2)   |
| Last reviewed                   | 2026-10-06                              |

## Source paths

- React (read-only): `packages/react/src/tabs/`
- Solid (target):    `packages/solid/src/tabs/`
- Docs (target):     `docs/solid/src/routes/(docs)/solid/components/tabs.mdx`
- Demos (target):    `docs/solid/src/demos/solid/tabs/`

## Parity note (plan 8, native fast path)

What React does (`packages/react/src/tabs/`): the root keeps the value, the tab map (from the
list's `CompositeRoot`) and the activation direction; the list is a `CompositeRoot` (roving focus,
Home/End, `aria-orientation`); a tab is `useButton` + `useCompositeItem` with `aria-selected`,
`aria-controls`, highlight sync on external value changes and `onKeyDownCapture` marking keyboard
navigation; a panel registers itself (for `aria-controls`), uses `useTransitionStatus` +
`useOpenChangeComplete`, `hidden`/`inert`/`tabindex`; the indicator measures the active tab into CSS
variables.

How the Solid-native version matches it: the same hooks (`useCompositeRoot` directly in the list,
`createNativeListItem` with an index guess for tabs and panels, the highlight-sync effect comparing
its own dependency snapshot); `useButton`'s composite keyboard logic (Space activation on keydown,
Space keyup cancellation regardless of `preventBaseUIHandler`) is inlined in `TabsTab.tsx`; a
hidden panel creates its machinery on first render with `animateInitialOpen` so its first open still
enters `'starting'`. Rendering follows `../solid/native-parts.md` ("Disclosure batch"). Parity
test: `packages/solid/src/tabs/Tabs.parity.test.tsx`.

## Open issues

- none recorded
