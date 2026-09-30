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
- Next sync target: v1.5.0 whenever upstream ships.
