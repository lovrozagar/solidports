---
tags: [perf, native, architecture, solid2]
sources: [packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/propsView.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts]
verified: 2026-10-17
---

# Target architecture

The Solid-native shape the perf rewrite aims at: compiled JSX with the tag chosen once, one grouped attribute binding per element, delegated handlers, one owner per root, keyed lists, and identical reactive-node order on server and client.

Solid 2 already has the primitives this needs. The mount and SSR gaps in [baseline](baseline.md) come from extra memos, `<Dynamic>`, props-view Proxies and per-part context providers, not from missing features.

## Where the code is today

- Slow path: every part goes through `useRenderElement` (`packages/base-ui/packages/solid/src/utils/useRenderElement.tsx`): an unowned attribute root (`:598`), a structure render effect (`:631`), a render effect per reactive key (`:676`), up to three source memos (`:200`, `:388`, `:430`), two children memos (`:781`, `:823`), and a layout effect for refs (`:480`). Props reach the element through `createPropsView` Proxies (`utils/propsView.ts`).
- Native kit: `utils/native/*` renders direct DOM for 25 files in 11 families (Accordion, Button, Checkbox, CheckboxGroup, Collapsible, Radio, RadioGroup, Switch, Tabs, Toggle, ToggleGroup). 150 of the 172 files calling `useRenderElement` never touch the kit.
- `canRenderNative` (`utils/native/index.ts:65`) refuses the server, hydration, Solid proxies (any `{...props}` wrapper), a `render` key, a non-static `ref`, and non-static `staticKeys`. Design-system wrappers and every SSR app therefore take the slow path.
- The kit creates elements with `document.createElement` (`:791`) and binds them with a plain, non-transparent `createRenderEffect` (`:224`), which takes hydration ids; that is why it must refuse hydration.
- Context: `provideContext` (`solid-helpers.tsx`) provides on one transparent `createOwner` plus `setContext` on the client (S2, plan 3 leaf 4.10), as `utils/native/context.ts` does; JSX providers still cost a provider root and two lazy memos each.
- `createSelector` (`solid-1-compat.ts:142`) is a Solid 1 shim: every key reader re-runs on any source change (O(n) per change).

Details: [render pipeline](../architecture/render-pipeline.md), [primitive costs](../solid/primitive-costs.md).

## Target, part by part

| concern | target |
| --- | --- |
| element | Compiled JSX. No `render`: literal intrinsic template. String `render`: `dynamic(() => tag, { static: true })`, which creates no reactive node. Function or element `render`: an untracked call with a plain props object built once (getters for reactive keys). No `<Dynamic>`, branch memos or `children()` per element. |
| props merge | Classify consumer keys once with `isStatic` / `hasStaticKeys`. Static keys go in the template or are assigned once. Reactive keys, `data-*`, `class` and `style` go in one grouped binding (`transparent: true, sync: true`) that diffs per key. A consumer spread is read once and accepted, not refused. Server: `ssrElement` with plain sources and an attributes thunk. |
| handlers | Module-level dispatcher per event using the `[fn, data]` tuple: consumer handler, then the `baseUIHandlerPrevented` check, then the part's handler. Delegate where Solid delegates. |
| state attributes | Inline in the grouped binding; no memo per attribute. |
| context | One `createOwner` per root and one `setContext` with a single record. |
| lists | `createProjection` for keyed highlight and selection; registration by creation-order guess plus binary-search fix-up; `mapArray` rows. |
| floating | One store per popup; memos only where many readers fan out; one effect running `autoUpdate`; position written through the binding. |
| transitions | One status signal and one effect group, created on first open. |
| SSR and hydration | Same component code on client, server and hydration. Id-consuming nodes (elements, memos, owners, non-transparent effects, `onSettled`) are created unconditionally and in the same order on both sides; client-only nodes are `transparent`. Never branch in a way that makes hydration's owners differ from the server's: a branch on `isHydrating()` is safe when the hydrating side creates what the server did, since nothing created outside hydration is claimed. |

What to carry over from other Solid libraries: untracked component calls, `[fn, data]` handlers, one presence signal per element, DOM-order registration. What to avoid: Proxy merges, `<Dynamic>` per element, whole-object spreads that re-assign every key on any change.

## Solid 2 constraints

Re-checked against the published 2.0.0-rc.15 packages (the version the repo pins) on 2026-10-16. Before probing installed sources, confirm `node_modules/solid-js/package.json` reports the pinned version; run `bun install` if it does not.

| constraint | rc.15 status | where (package-relative) |
| --- | --- | --- |
| `on:` / `oncapture:` namespaces are gone, but the compiler still accepts them | changed: rc.13 emitted a dead `addEvent(el, ":keydown", …)`; rc.15 emits `setAttribute(el, "on:keydown", fn)`, which is still not a listener. The port has 0 uses; ban it in lint. | `@solidjs/web/dist/web.js:1647` |
| no keyed `createSelector` | confirmed; build keyed selection on `createProjection` | `solid-js/dist/solid.js:932` |
| `createEffect` apply runs whenever compute re-runs and passes the gate (effects are not equality-checked like memos) | confirmed; return primitives or diff in apply | `@solidjs/signals/dist/prod/core/core.js:714` |
| `merge` with a function source allocates a memo | confirmed on client; the server id cost was seen on rc.13 | `@solidjs/signals/dist/prod/store/utils.js:924` |
| `setContext` copies the whole context record per call | confirmed; one `setContext` per root | `@solidjs/signals/dist/prod/core/context.js:55` |
| plain `createRenderEffect` takes a hydration id; `transparent: true` avoids it; `sync` exists | confirmed; the compiled-template `effect` helper is transparent | `core.js:705`, `@solidjs/web/dist/web.js:61` |
| `createTrackedEffect` deprecated | confirmed; the port has 0 uses | `@solidjs/signals/dist/prod/signals.js:205` |
| `onSettled` takes an id on the server | confirmed; `flush()` inside `onSettled` throwing was seen on rc.13 only | `solid-js/dist/server.js:1913` |
| `<Dynamic>` deprecated; `dynamic(src, { static: true })` creates no memo | confirmed; the port still has 39 `<Dynamic` occurrences in 12 files | `solid-js/dist/solid.js:1458` |
| a context Provider is `createRoot` + `setContext` + `children()` | confirmed; use `createOwner` + `setContext` | `solid-js/dist/solid.js:6` |
| delegated `[fn, data]` handlers; a `disabled` node skips only its own handler | confirmed | `@solidjs/web/dist/web.js:630`, `:1694` |
| attribute writes are no-ops while hydrating | confirmed | `@solidjs/web/dist/web.js:518` |

`isStatic` and `hasStaticKeys` live in `@solidjs/signals/dist/prod/store/utils.js` (`:222`, `:194`); `mapArray` and `repeat` in `dist/prod/map.js`; `For` and `Repeat` in `solid-js/dist/solid.js`.

Ranked steps toward this target: [optimization map](optimization-map.md). Decisions taken along the way go in the [decision log](../decisions/log.md).
