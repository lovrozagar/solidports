---
tags: [perf, native, audit, solid2, spec]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/propsView.ts, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/store/SolidStoreV2.ts, packages/base-ui/packages/solid/src/utils/useTransitionStatus.ts, packages/base-ui/packages/solid/src/utils/useOpenChangeComplete.tsx, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts]
verified: 2026-10-16
---

# Core audit

The 2026-10-16 audit of the shared core (plan 3, leaves 2.1–2.3) finds that the native kit already matches compiled JSX on the client, so the rewrite makes that cost universal and adds the server and hydration path. The core API spec is below, in the order the pilot needs it.

Measurements are dev runtime, jsdom, Solid 2.0.0-rc.15, nodes beyond a plain element. Timings come from a loaded machine, so read them as ratios within a run. Detailed findings: [render path](audit/render-path.md), [reactive plumbing](audit/reactive-plumbing.md), [lists and floating](audit/lists-floating.md).

## Findings that change the plan

- The native kit is at the floor on the client: Button 1 node (the dev root), 3 with reactive inputs, the same as hand-written `<button title={a()} disabled={b()}>`. It falls short on coverage (25 of about 175 render files), on SSR and hydration (its effect is not transparent and it refuses both), on 10 `createNativeElement` sites that cannot be claimed during hydration, on three overlapping renderers, and on per-element handler closures.
- `transparent: true` on the element effect adds no client node and drops the hydration id, so a single code path for client, server and hydration is free in node terms.
- The slow path (`useRenderElement`) costs 9–13 extra nodes per element, mounts about 5x slower and updates 4–7x slower than native.
- `{...props}` wrappers: on rc.15 a pure spread stays native (4 nodes). Only a spread merged with another prop (a `merge` proxy) falls back, at 12 nodes. Optimization-map item 2 shrinks to "accept `merge` proxies".
- Context: a JSX provider or `provideContext` adds 5 nodes, three nested add 13. A transparent owner adds 1 node however many contexts it carries. Merging contexts into one record is not faster.
- `createDepsEffect` and `createDepsRenderEffect` cost 2 nodes at 107 sites; `createEffectGroup` gives the same semantics in 1.
- Selection: the compat `createSelector` reruns all n readers per change (13.3 ms per 50 changes at 1000 readers); a `createProjection`-keyed selector reruns 2 (1.7 ms).
- Closed transitions: a closed element costs 2 computeds plus 1 eager `useOpenChangeComplete` effect, 3 nodes that should be 0 (about 900 for a 300-item Accordion).
- `SolidStore` reads are optimal. Writes cost about 40x a plain signal (2.09 vs 0.05 ms per 1000), and derived selectors create one memo per call site instead of one per store.
- Lists: an open Select item costs 27 nodes (a hand-written item needs 3–5); one hover in a 100-item Select reruns the selector 102 times; every `CompositeList` flush rebuilds and re-sorts the whole list; `useInteractions` re-merges all item props when typeahead's `enabled` flips; there are 18 floating store memos where at most 3 are needed.
- Signal-writing effects: about 20 of 188 effect sites can be derived. That is a correctness and latency fix (one stale flush less), not a node lever.

## Core API spec

### S1. `renderElement(props, spec)`: one element binding for every part

Replaces `useRenderElement` and the three native renderers. The full sketch is in [render path](audit/render-path.md) section 3.

- Setup, untracked: classify consumer keys once with `isStatic` / `hasStaticKeys`, through `merge` proxies too.
- At most one `createRenderEffect(compute, apply, { transparent: true, sync: true })` per element. It writes part attributes, state attributes through a precompiled mapping table, reactive consumer keys, class and style, and diffs per key against `prev`.
- Handlers: module-level `[dispatch, record]` tuples. The order is gate, `makeEventPreventable`, consumer handler, then part handler unless `baseUIHandlerPrevented`. No per-element closures.
- `render`: absent → compiled template; string → `dynamic(() => tag, { static: true })`; component object → `createComponent` with one getter props object; function → called once, untracked. Only a changing `render` keeps a branch memo.
- Refs are applied once; part refs are released with `null` on dispose; no layout effect.
- Server: `ssrElement` with the same classification and an attributes thunk. Hydration: claim the compiled template, then one post-hydration reconcile per element, moved from `useRenderElement.tsx:694–747`.
- Budget: 0 nodes with literal inputs, 1 with any reactive input, +1 for reactive children.

### S2. `provide(entries, render)`: one transparent owner per part

On the client, one `createOwner({ transparent: true })` plus one `setContext` per context. It replaces 41 `provideContext` sites and 70 JSX providers.

The server and hydration render the context's provider instead (D5). The server's owners are `solid-js`'s own, and `solid-js` exports no `setContext`. The `@solidjs/signals` `setContext` writes a field that the production server never reads (`test/ssr/production.test.ts`). The server's transparent `createOwner` takes no id (`context.ssr-fixtures.tsx`), but on the dev builds only, so it carries no context in production.

### S3. Effects in one node

`createDepsEffect` and `createDepsRenderEffect` are rebuilt on `createEffectGroup`, same semantics. Multi-effect hooks use one `createEffectGroup`.

### S4. `createKeyedSelector(source)`

A keyed `createProjection` created once at the list root, unconditionally on both sides. A multi-select variant diffs the key sets. Value-keyed selection needs a stable key per item (the registration index). The compat `createSelector` shim is deleted.

### S5. Lazy closed state

`useTransitionStatus` while never opened: `mounted = open`, `transitionStatus = undefined` as plain accessors. The writable computeds and `useOpenChangeComplete` are created on first open inside `runInLazyScope`. Closed elements cost 0 nodes for the transition machinery.

### S6. Later phases (outline only)

These are not needed for the pilot:

- `SolidStore` write fast path; derived selectors shared per store.
- Lists: incremental DOM-order registration, keyed highlight on S4, one delegated handler per list.
- Floating: one shared set of store reads per popup, and elements bound into the store instead of synced by an effect.

## Pilot order (plan phase 3)

1. **3.1, failing tests:**
   - Collapsible budgets: Trigger 1 node plus 1 per reactive group, closed panel transitions 0, zero hydration-id delta against the compiled-JSX equivalent.
   - Server render and hydration within 1.25x of the floor and below React, judged on production builds by `bench:component`'s exit bar (the dev unit suite keeps only deterministic guards).
   - The S2 server transparent-owner test.
   - Re-measure the prototype component anomaly (a test-file component measured 2 nodes above the direct call) inside a real part file before fixing the numbers.
2. **3.2, core:** S1, S2, S3 and S5. Move Collapsible's `createNativeElement` uses to compiled templates.
3. **3.3, Collapsible:** Root, Trigger and Panel on S1, S2 and S5 on all three sides in one commit; retire `canRenderNative` for the family. Then Accordion: items keep the `createNativeListItem` contract, and `isOpen` (`AccordionItem.tsx:94`) uses S4.
4. **After the pilot:** route intrinsic static tags in `useRenderElement` through S1, so the other 150 callers benefit (map item 1).

## Hydration rules for every step

- A family switches server, hydration and client in one commit, gated by `test/hydration`, `*.hydration.test.tsx`, `test/ssr` and the docs crawl.
- Never branch on `isServer` / `isHydrating()` in a way that changes id-consuming nodes; anything created conditionally is transparent or goes through `runInLazyScope`.
- Lazy nodes (S5) go through `runInLazyScope`; `createProjection` (S4) is created unconditionally; `onSettled` is called unconditionally.
- Writable memos that replace effects now run on the server: no DOM reads in them.

## Dev warning to expect

Rendering 1000 children under one element makes rc.15 dev emit `[HUGE_FAN_IN] Computation "div.children" tracked 2000 sources`. The warning census (1.9) should attribute it to the fixture or the library rather than treat it as new.

Related: [target architecture](target-architecture.md), [optimization map](optimization-map.md), [primitive costs](../solid/primitive-costs.md).
