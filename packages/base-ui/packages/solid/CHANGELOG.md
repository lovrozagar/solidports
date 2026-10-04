## 1.8.0-4 — 2026-10-05

(1.8.0-2 was tagged on the wrong commit and 1.8.0-3 failed CI; neither was published.)

- **Portals render on the server**: a portal that renders on the first pass (an app-root `Toast.Portal`) crashed server rendering with `document is not defined`, because the container defaulted to `document.body` during render. The container now resolves only on the client after hydration settles, as React sets its portal node in an effect: the server renders nothing there and hydration has nothing to mismatch.
- **Hydration keeps client-only attributes**: Solid skips attribute writes for the whole synchronous `hydrate()` call, so a value that changed inside it was lost, such as a hydrated tab's `aria-controls` and its panel's `aria-labelledby` (registered in effects). Parts attached while hydrating re-apply their attributes once `hydrate()` returns.
- **Server rendering and hydration tests**: an `@solidports/base-ui:ssr` Vitest project (`test/ssr`) renders fixtures with Solid's SSR transform, and `test/hydration` hydrates server HTML in jsdom; both run with `test:solid:*`.
- **Diagnostics suite**: ignores `HOT_SCOPE_TIME`, a CPU-time budget that slower CI runners tripped; the suite guards the reactive graph.

## 1.8.0-1 — 2026-10-04

Solid port of `@base-ui/react@1.8.0` (1.4.1 → 1.8.0). First npm release, on the `next` dist-tag.

- **Packaging**: ships TypeScript/JSX source (`solid` export condition) plus prebuilt declarations; no dependencies of its own. Peers: `solid-js` and `@solidjs/web` `~2.0.0-rc.13`, `@floating-ui/dom`, `@floating-ui/utils`; optional `date-fns`, `@date-fns/tz`, `luxon` for the temporal adapters.
- **Reactivity**: per-key prop merging in `useRenderElement` (no whole-props memo); derived state replaces effect relays, so Solid dev diagnostics stay quiet.
- **Verification**: Base UI's own e2e specs and visual regression suite run against the Solid port.
- **OTP Field**: public `sanitizeValue` renamed to `normalizeValue`. Normalization now runs after whitespace and `validationType` filtering, then clamps to `length`.
- **Combobox**: `Combobox.createItems()` collection API for derived values and labels.
- **Autocomplete**: dedicated `Trigger`, `InputGroup`, and `Separator` parts (same shape as `@base-ui/react@1.8.0`).
- **Drawer**: `Drawer.VirtualKeyboardProvider` for keyboard-aware bottom sheets; `Drawer.createHandle()`; `Drawer` public namespace (preview `DrawerPreview` alias retired).
- **Internals**: Solid `internals/` export map matches 1.8.0 React (`csp-context`, `useAnchorPositioning`, `getDisabledMountTransitionStyles`, popup/store/field helpers).
- **Reference snapshot**: nested `packages/react` is `@base-ui/react@1.8.0`; nested `packages/utils` is `@base-ui/utils@0.4.0`.

### Upstream tracking

- React base: `@base-ui/react@1.8.0` snapshot in `packages/react/src/` (mui/base-ui@v1.8.0, commit `47b4052`)
- Next sync target: next upstream minor after v1.8.0.

## 1.4.1-sp.1 — 2026-04-24

First release under `@solidports/base-ui` namespace.

### What changed vs msviderok/base-ui-solid@1.0.0-beta.9

- **React v1.2.0 → v1.4.1 parity**: all 46 primitives carry upstream v1.4.1 semantic changes.
- **New primitive**: `otp-field` ported from upstream v1.4.0.
- **Reorg**: `composite`, `labelable-provider`, `use-button` moved into `internals/` per upstream layout.
- **Floating-ui sync**: full 12053-LOC `floating-ui-react` delta ported to `floating-ui-solid` (useFloating, useFloatingRootContext, hooks for hover/focus/click/dismiss/role/listNavigation/typeahead, FloatingFocusManager, FloatingPortal, tabbable rewrite, safePolygon).
- **Quality fixes**: stripped debug `console.log` in `collapsible/panel`, replaced `onMount(handlePanelRef)` ref-timing hack with direct ref callback, all per msviderok's own collapsible gap analysis.
- **Build**: ships TS source via subpath exports (no compiled `esm/` distribution issues). SSR-safe out of the box.

### Test baseline

- jsdom: 4992 passing / 8 pre-existing fails / 631 skipped across 243 test files.
- Pre-existing fails (at msviderok 1.2.0 baseline, not regressions): MenuTrigger 1, NavigationMenuContent 1, NavigationMenuRoot 4, ToolbarButton Switch 2.

### Upstream tracking

- React base: `@base-ui/react@1.4.1` snapshot in `packages/react/src/` (byte-identical to mui/base-ui@v1.4.1)
- Planned next sync at the time: v1.5.0.
