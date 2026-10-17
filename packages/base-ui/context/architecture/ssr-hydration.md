---
tags: [ssr, hydration, testing, native]
sources: [packages/base-ui/packages/solid/test/hydration, packages/base-ui/packages/solid/test/ssr, packages/base-ui/packages/solid/test/ssrFixtures.ts, packages/base-ui/packages/solid/test/hydrationSentinel.tsx, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/runInLazyScope.ts, packages/base-ui/packages/solid/src/utils/useId.ts, packages/base-ui/scripts/docs/templates/src/adapters/react.ts]
verified: 2026-10-17
---

# SSR and hydration

Hydration claims each server element by a key derived from the owner tree, so the client must create the same id-consuming nodes in the same order as the server. `*.ssr-fixtures.tsx` plus a sentinel catch any drift; the native kit opts out of hydration entirely.

## Hydration id rules (Solid 2.0.0-rc.15)

Verified against the published rc.15 `solid-js`, `@solidjs/web` and `@solidjs/signals` builds. The installed `node_modules` copy may lag the catalog pin; check `node_modules/solid-js/package.json` before reading sources there.

- A key is `getNextChildId(owner)`. Client `getNextElement` (`@solidjs/web/dist/web.js`) reads `sharedConfig.getNextContextId()` and looks the key up in `sharedConfig.registry` (built from `_hk` attributes); server `ssrHydrationKey` (`@solidjs/web/dist/server.js`) prints the same id as ` _hk=…`.
- Client node creation (`inheritId` in `@solidjs/signals/dist/prod/core/owner.js`): an explicit `id` wins, a `transparent` node shares its parent's id, anything else consumes the parent's next child id when the parent has one.
- Consume an id on the client: elements, owners, `createMemo`, function-form `createSignal` (a computed), non-transparent `createEffect` / `createRenderEffect`, `createUniqueId` while hydrating.
- Consume nothing: plain `createSignal(value)`, compiled bindings (`effect()` in `web.js` is a transparent render effect), `transparent: true` nodes, anything under `NoHydration`.
- Server (`solid-js/dist/server.js`): `createMemo` and `createOwner` honor `transparent`, but `serverEffect` (behind `createEffect` and `createRenderEffect`) calls `createOwner()` without options, so every server effect consumes an id. `onSettled`, `createTrackedEffect`, `Portal`, unkeyed `Show` and each unkeyed `Match` burn an id with `getNextChildId`.
- Attribute and property writes return early while the node is hydrating (`isHydrating(node)` guards in `web.js`); the server value stays until the next change.
- `useId` (`src/utils/useId.ts`) calls `createUniqueId` once: a context id when hydrating or on the server, `cl-N` on a plain client render.

Rules that follow for library code:

- Create id-consuming primitives unconditionally and in the same order on both sides. Never branch in a way that makes hydration's owners differ from the server's. A branch on `isHydrating()` is safe when the hydrating side creates what the server did: nothing created outside hydration is claimed (the slow path's branch renders `<Dynamic>` while hydrating, as the server does, and the element directly otherwise).
- Machinery created later (first open, first read) goes through `runInLazyScope(owner, create)` (`src/utils/runInLazyScope.ts`). It wraps the work in an owner with its own id (`<owner id>-<n>-`), so the owner's later children keep the server's keys. A single late computation can pass `transparent: true` instead.

## Why the native kit opts out

`canRenderNative(props, staticKeys)` in `src/utils/native/index.ts` returns false on the server and while `isHydrating()`, before checking for proxied props, `render`, a reactive `ref` or reactive `staticKeys`. The native kit builds elements with `document.createElement` (`createNativeElement`) instead of claiming server nodes through `getNextElement`, and attaches a plain owned `createRenderEffect`. Hydrating it would leave the server element unclaimed and shift every later key, so SSR apps and anything mounted during hydration take the `useRenderElement` slow path. See the [render pipeline](./render-pipeline.md).

## Hydration suite (`packages/solid/test/hydration`)

- `globalSetup.ts` (registered in `vitest.config.mts`) runs in Node before the run, so hydration tests also work in browser mode where Vite's SSR loader is unavailable. It server-renders each `test/hydration/*.server.tsx` entry and every `src/**/*.ssr-fixtures.tsx` fixture (38 fixture files), then hands the HTML to tests through `project.provide` (`serverHtml`, `ssrFixtures`, URI-encoded).
- `serverRender.ts` starts a Vite server with `@solidjs/vite-plugin` in SSR mode. Each fixture renders three ways: `renderToString`, `renderToStream`, and `renderToStream` inside `Errored` + `Loading` boundaries (`SERVER_RENDERS` in `test/hydrationSentinel.tsx`). A throwing fixture records `{ error }` without hiding the others.
- Fixture modules default-export `defineSsrFixtures(import.meta.url, { name: () => <JSX/> })` (`test/defineSsrFixtures.ts`). The `files` list in `packages/solid/package.json` keeps them out of the published package.
- `ssrFixtures.hydration.test.tsx` runs every fixture under each render mode and asserts:
  1. the sentinel (a `<span>` with a hydration key and a reactive attribute, rendered after the fixture) is server state before hydration;
  2. after `hydrate()`, `unclaimedNodes()` (what remains in `sharedConfig.registry` inside the container) is empty;
  3. the sentinel is the same node and updates when advanced, which proves no key shifted;
  4. form control `value` / `checked` / `selected` match the server state;
  5. form-state attributes match a plain client render of the same fixture.
- `renderServer` in `test/ssrFixtures.ts` is the reusable helper. It sets up `window._$HY` as `<HydrationScript />` would. Component tests use it too, for example `src/collapsible/root/CollapsibleRoot.hydration.test.tsx` mounts a client part after hydrating an Accordion fixture.
- Targeted tests: `tabs.hydration.test.tsx` checks `aria-controls` / `aria-labelledby` wiring; `navigation-menu.hydration.test.tsx` guards a trigger whose merged `children` were read twice, creating them twice and printing the wrong key.

## Server tests (`packages/solid/test/ssr`)

Run as the `@solidports/base-ui:ssr` project (`vitest.ssr.config.mts`, Node environment, excluded from the main project).

- `ssr.test.ts` renders fixtures through Vite SSR and asserts: a toast portal renders without touching `document`; `render` config parts emit the right tags; uncontrolled defaults render as `value` attributes (never `defaultvalue`) across Combobox, Autocomplete, OTP, NumberField, Checkbox, Switch, Radio, Slider, Select and Toolbar inputs.
- `server-purity.test.ts` server-renders every component's generated docs demos (`docs/solid/src/app/(docs)/solid/components/*/demos`) in a child process per component (`serverWrites.mjs`) and asserts no `[SERVER_WRITE]` warning: rendering must write no signal, store or optimistic state.

The built docs site has its own crawl, `bun run docs:check-hydration --serve`, which fails on any unclaimed server element per route.

## Elements kept as values

An element kept as a value (`element(() => …)`) must be placed with `place()`. Inserted bare, Solid calls it inside the hole's inner computation, which also tracks what it renders, so any update inside rebuilds it; inserted by name or as a memo value, server and client key its content differently. `place(value)` calls the function in the hole, so keys agree. Both helpers live in `scripts/docs/templates/src/adapters/react.ts` (generated demos import them from `docs/src/adapters/react`). `placeElements` in `scripts/docs/react-to-solid.mjs` wraps local element values, element memos and props typed `JSX.Element` automatically. See the [docs pipeline](../tooling/docs-pipeline.md).
