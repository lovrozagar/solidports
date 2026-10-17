---
tags: [solid, perf, primitives, compiler, ssr]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts]
verified: 2026-10-17
---

# Primitive costs

What each Solid 2.0.0-rc.15 primitive allocates and costs, what the compiler emits, and which nodes take hydration ids. The 2–12x mount and SSR gaps come from extra memos, `<Dynamic>` and props views, not from missing primitives.

## Provenance

- Numbers: local, rc.15, 2026-10-16, Node 22.12, production builds, best of 5. Micro-benchmarks create 20,000 nodes per row; the SSR benchmark renders 1000 parts. Read them as ratios.
- Paths: `signals/` is `node_modules/@solidjs/signals/dist/prod/`, `solid.js` and `server.js` are `node_modules/solid-js/dist/`, and `web.js` is `node_modules/@solidjs/web/dist/web.js`.

## Cost table

| Primitive | Source (rc.15) | ns/op | Notes |
| --- | --- | ---: | --- |
| `createSignal(v)` | `signals/signals.js:71`, `core/core.js:795` | 4 | No owner link, no hydration id |
| `createSignal(fn)` | `signals/signals.js:72` | memo cost | Writable memo: write wins until a dependency changes |
| `createMemo` | `signals/signals.js:91`, `core/core.js:532` | 119 | Owned, eager, takes an id unless `transparent` |
| `createMemo({ lazy: true })` | same | 78 | Still allocates the node |
| `createRenderEffect` | `signals/signals.js:197`, `core/effect.js:17` | 157 | Takes an id |
| `createRenderEffect` with `{ transparent: true, sync: true }` | same | 124 | No id. The compiler's `effect()` uses this (`web.js:61`) |
| `createEffect` (queued apply) | `signals/signals.js:162` | 185 | Apply runs on every recompute (`equals: false`, `core/core.js:714`) |
| `createTrackedEffect` | `signals/signals.js:245` | not measured | `@deprecated` |
| `onSettled` | `signals/signals.js:634` | not measured | Lazy tracked computed; one id on client and server (`server.js:1913`) |
| `createOwner` | `core/owner.js:263` | 29 | |
| `createOwner` + `setContext` | `core/context.js:55` | 125 | `setContext` copies the whole record |
| `createRoot` (nested) | `core/owner.js:323` | 70 | |
| `merge(a, b)` create | `store/utils.js:906` | 34 | Proxy view |
| `merge(a, b)` create + 4 reads | same | 179 | A plain `{ ...a, ...b }` with 4 reads costs 288 |
| `omit(a, "x")` create + 2 reads | `store/utils.js:1009` | 68 | |
| `merge(() => a, b)` | `store/utils.js:924` | 209 | A function source allocates a memo |
| `mapArray` row | `signals/map.js:19` | 100 | One owner per row |
| `createProjection` | `store/projection.js:292` | see below | One computed plus per-key signals |

Selection over 2000 rows, 50 changes, with one render effect per row:

- A predicate (`sel() === key`) reruns 2000 effects per change.
- A projection reruns 2 per change.

The port's compat `createSelector` (`solid-1-compat.ts:143`) is the predicate shape and has no call sites.

A projection read is a proxy access: inside a tracking computation, about 126–170 ns per read against a plain signal's 16 (Node microbench, 300 keys × 14 reads, 2026-10-17; 170 ns when the slot name is built per read, 126 when it is bound once). Solid 2 exposes no public handle to a store key's node, so the read cannot be bound to the signal behind it. The keyed selector (`createKeyedSelector`) stays a projection anyway:

- Per-key plain signals written by one root effect read at signal speed, but they tear. The writer applies in the effect phase, after a reader that re-runs for another source in the same batch has already read the old membership, so that reader shows a mixed pair for one pass (`second:open` before `second:closed`). A projection is pulled and never does; `createKeyedSelector.test.ts` pins it.
- A per-key memo is a node per key, and one root memo of the set re-runs every reader per change.

What helps instead: bind the read once per key (`isSelected.forKey(key)`, about 26% less per read), and cut how many reads a part makes (an Accordion item read its membership 14 times at mount, 10 since plan 3 leaf 5.1.4).

## Composite primitives

| Construct | Source | What it creates |
| --- | --- | --- |
| Context provider | `solid.js:6` | `createRoot` + `setContext` + `children()` (2 lazy memos), and in dev the component's own owner. `provideContext` renders it only on the server and while hydrating; on the client it is one transparent owner (`createContextOwner`, `solid-helpers.tsx`). |
| Native context | `src/utils/native/context.ts` | One transparent owner plus `setContext` per part |
| `children(fn)` | `solid.js:21` | 2 lazy memos |
| `Show` | `solid.js:1494` | 3 memos (2 when `keyed`) |
| `Switch` / `Match` | `solid.js:1518` | `children()`, a selector memo, and 1–2 memos per `Match` |
| `For` | `solid.js:1473` | Lazy `mapArray` under the caller's owner |
| `dynamic(source)` | `web.js:2153`, `solid.js:1376` | One shared lazy memo per `dynamic()` call, plus 2 memos per instance |
| `<Dynamic>` | `web.js:2163` | `dynamic()` plus `omit`. `@deprecated` in rc.15 types. `useRenderElement` uses it on the slow path (`src/utils/useRenderElement.tsx:816`) |

## Compiler output

Checked with `@solidjs/compiler` (Oxc) and `@solidjs/babel-plugin` rc.15; both emit the same code.

- **Static attributes** stay in the template. A static element costs one `cloneNode` and zero reactive nodes.
- **Dynamic attributes** of one element are grouped into one `effect(() => ({ e, t }), ({ e, t }, prev) => …)` that diffs per key.
- **Element spread:** `<div {...props} class={x()} />` becomes `spread(el, [props, { get class() {} }])` (`web.js:707`). That is one `insert` for children plus one effect that recollects every prop and re-`assign`s on any change (`:947`).
- **Component spread:** `<Part {...props} class="a" />` becomes `createComponent(Part, mergeProps(props, { … }))`, one view per call site.
- **Events:** a delegated handler sets `el._$$click` (a tuple `[fn, data]` also sets `_$$clickData`, with no closure). A non-delegated handler gets one `addEventListener`. See [refs and events](refs-and-events.md).
- **Refs:** a ref is `ref(() => r, el)` when `r` is a function or array, else a plain assignment.
- **Hydratable DOM:** elements are claimed with `getNextElement` (`web.js:1488`), child inserts are wrapped in `scope()`, and attribute writes are skipped while hydrating (`setAttribute`, `web.js:570`).
- **SSR:** templates become `ssr(tmpl, ssrHydrationKey(), ssrGroup(...))`. Spreads become `ssrElement(tag, props, …)` (`node_modules/@solidjs/web/dist/server.js:3171`).

## Hydration ids

- Ids come from `getNextChildId` via `inheritId` (`core/owner.js:166`). Consumers: elements, non-transparent memos, effects and owners, `onSettled`, and `scope()` inserts.
- **Server mirror:** server memos and effects allocate a pooled owner and an id (`server.js:72`). A server render effect runs its apply once; a server `createEffect` runs compute only.
- **Free:** signals, compiled bindings (`effect()` is transparent) and transparent owners.
- **Rule:** create id-consuming nodes unconditionally and in the same order on both sides. Mark client-only nodes `transparent`. See [SSR and hydration](../architecture/ssr-hydration.md).

## SSR benchmark (local, rc.15, 2026-10-16)

| Shape (1000 parts) | ms | vs direct |
| --- | ---: | ---: |
| Direct JSX, state attributes inline | 0.38 | 1.0x |
| Direct JSX plus 4 memos per part | 1.06 | 2.8x |
| Element spread over `merge`/`omit` views | 0.92 | 2.4x |
| `<Dynamic>` + merged props + `children()` (the slow path's shape) | 2.90 | 7.6x |

## Changes since rc.13

Same-machine, same-session runs of both versions:

- **Benchmarks:** nested `createRoot` is about 2x cheaper (139 to 74 ns) and a `mapArray` row about 25% cheaper. Everything else, SSR included, is within noise.
- **Layout:** `@solidjs/signals` adds an `observe` build; `store/next/projection.js` became `store/projection.js`.
- **Delegation:** the handler property prefix changed from `$$` to `_$$` (`web.js:358`), and listeners attach per render root instead of on `document`.
- **Event syntax:** `on:`, `oncapture:` and lowercase `on*` now compile to attributes instead of dead listeners.

## Related

- [Reactivity](reactivity.md), [render pipeline](../architecture/render-pipeline.md), [perf baseline](../perf/baseline.md), [optimization map](../perf/optimization-map.md).
