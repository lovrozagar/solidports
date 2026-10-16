---
tags: [perf, audit, render, native]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/propsView.ts, packages/base-ui/packages/solid/src/utils/native]
verified: 2026-10-16
---

# Render path audit (plan 3, leaves 2.1–2.3)

Scope: `utils/useRenderElement.tsx`, `utils/propsView.ts`, `utils/native/*`, and how parts choose between them. Solid 2.0.0-rc.15 (verified via `require('solid-js/package.json')`). All paths are under `packages/base-ui/packages/solid/src/`.

Probe: a temporary jsdom cost test (dev build, `DEV.hooks.onOwner` count, `perPart` = two copies minus one, minus a plain `<button>` in the same position). Mount is 1000 instances, median of 7; update is 1000 instances toggled, median of 21. Raw output: `.tmp/grunt/audit/probe-out.txt`. Timings come from a loaded machine (load average about 20), so use ratios within one run; two runs are shown where they differ. Node counts are deterministic and include the dev-only component root (1 per component).

## 1. What each piece costs today

### Measured (rc.15, dev, nodes beyond a plain element)

| shape | nodes | mount 1000 (ms, run A / run B) | update 1000 (ms) |
|---|---:|---:|---:|
| plain `<button>` | 0 | 5.8 / 5.4 | – |
| Button native, literal props | 1 | 6.4 / 9.6 | – |
| Button native, reactive `disabled` + children | 3 | – | 3.05 / 3.53 |
| Button slow (`render="button"`) | 10 | 32.6 / 46.3 | 11.9 / 25.4 |
| Button slow, reactive | 12 | – | – |
| Button slow, render function | 11 | – | – |
| Button through a pure `{...props}` wrapper | 4 | 7.4 / 9.2 | – |
| Button through `{...props}` plus one extra prop (merge proxy) | 12 | – | – |
| Separator (slow path only) | 14 | 28.5 / 35.2 | – |
| Collapsible.Trigger native (beyond the root without a trigger) | 3 | – | – |
| Collapsible.Trigger slow (`render="button"`) | 16 | – | – |
| compiled `<button title={a()} disabled={b()}>` | 1 | – | – |

- The slow path costs 9–13 more nodes per element than native, mounts 5x slower and updates 4–7x slower.
- Native Button is at the compiled-JSX floor: 1 dev root, plus 1 grouped effect and 1 children insert when inputs are reactive. A hand-written `<button title={a()} disabled={b()}>` costs the same single grouped effect.

### Where the slow-path nodes come from (`utils/useRenderElement.tsx`)

| node | line | when |
|---|---|---|
| `renderProp` memo | `:200` | `render` present and not static, or server/hydration |
| `partSources` memo (shallowEqual) | `:388` | `params.props` has a getter or a function entry, or server/hydration |
| `sources` memo (shallowEqual) | `:430` | tag accessor, dynamic render, dynamic part sources |
| per-element ref layout effect | `:480` | `refsCanChange` (server/hydration always) |
| attribute root (`createRoot` under the module `attributeRootOwner`) | `:598` | every intrinsic client element |
| structure render effect over the key set | `:631` | every intrinsic client element |
| one render effect per non-static key | `:676` | each reactive key, including every state `data-*` the part derives |
| children memo | `:781` / `:823` | any non-literal children |
| `<Dynamic>` (dynamic memos plus `omit`) | `:816`, `:828`, `:834` | component tags, server renders, the dynamic-render branch |
| `dynamic(() => tag, { static: true })` | `:759` | static render: no node |
| `<Show>` (3 memos) | `:847` | parts that pass `enabled` |
| outer component plus `{...renderFnProps}` re-spread | `:853` | every part: one extra component layer per element |

`propsView.ts`:
- A `Proxy` per view (`:465`, `:631`) whose `get` walks every source per key read.
- The lazy key-list memo is transparent (`:127`).
- Each custom state-attribute mapper gets one transparent memo per state key (`:524`), plus a layout memo (`:550`).
- An accessor source costs a memo (`:23`).
- Every attribute read in an effect walks 6+ sources: tag defaults, render props, state attributes, part sources, the render config, class/style (`computeSources`, `:410`).

Hydration ids:
- Every non-transparent memo and effect above takes an id. On the server and during hydration the slow path deliberately takes the memo paths (`serverOrHydrating`, `:190`) so both sides allocate the same owners.
- That is why SSR costs 2.3–12.6x React in `perf/baseline.md`: native families (Checkbox, Accordion, Tabs) still render the slow path on the server.

## 2. Is the native kit optimal?

On the client, for node count: yes. Native Button and Collapsible.Trigger are at the compiled-JSX floor. Its shortcomings are elsewhere:

1. **No server or hydration path.** `canRenderNative` refuses both (`native/index.ts:65`). The kit's effect is a plain `createRenderEffect` (`native/index.ts:224`, `native/element.ts` renderer), which takes a hydration id, so it cannot run under hydration without shifting ids. The probe shows `transparent: true` adds no client node, so making it transparent is free. Every SSR app and every hydrated page pays the full slow path today.
2. **Coverage.** 25 files in 11 families use it. 150 of the 172 `useRenderElement` callers never do, including the worst mounts: Progress, Meter, Separator (14 nodes), Avatar, useRender, Toolbar. The kit is opt-in per part with hand-written attribute writers, so each part duplicates its slow-path logic: Button keeps both paths (`button/Button.tsx:41–74` slow, `:186–247` native), and Collapsible.Trigger likewise (`collapsible/trigger/CollapsibleTrigger.tsx:34–79` vs `:145–164`). That doubles the surface the parity tests must hold equal.
3. **Proxies.** Measured on rc.15, a pure `{...props}` wrapper is not a proxy and stays native (4 nodes; mount equal to native). The docs' "wrapper costs 15 / refused" is stale rc.13 data. Only a spread merged with another prop (`<Button {...p} class="x"/>`, a `merge` proxy) falls back, at 12 nodes. Optimization-map item 2 is therefore narrower than written: accept `merge` proxies by reading `hasStaticKeys` and `isStatic` through the proxy once at setup.
4. **Three renderers with overlapping jobs.** `renderNativeElement(spec)` in `native/index.ts:123` (CheckboxGroup, RadioGroup) takes a part-built writer. `renderNativeElement(el, props, spec)` in `native/element.ts` (Collapsible, Accordion, Tabs) writes state attributes itself. `createLayout` with module-level writers (`native/index.ts:370`) serves Checkbox, Radio and Switch roots. They differ in handler, style and ref handling. For example, only `element.ts` skips re-assigning an unchanged string `style`, a workaround for `assign` resetting `cssText`.
5. **Element creation.** Button and the disclosure triggers clone compiled templates. Ten sites use `createNativeElement` (`document.createElement` plus `setAttribute` per attribute, `native/index.ts:787`): Checkbox, Radio, Switch.Thumb, ToggleGroup, CheckboxGroup. Those cannot be claimed during hydration (no `getNextElement`) and skip the template clone. They must move to compiled templates for one code path.
6. **Per-instance closures.** Handler composition allocates a `composeHandler` closure per handler key per element. Collapsible.Trigger builds 3 plus a `disabled` closure (`collapsible/trigger/CollapsibleTrigger.tsx:89–124`, `:160`). Button's literal path is the exception: it uses module-level `[fn, props]` tuples (`button/Button.tsx:214–220`), which allocate nothing per element. That should be the rule everywhere.
7. **Writer rebuilds.** Each effect run builds a fresh target object and runs `assign` over every key. `assign` diffs against `prev` per key, so DOM writes are minimal, but the compute re-reads every state key and every reactive consumer key on any change. That is acceptable at 1–5 keys; per-key effects (the slow path) cost more.

## 3. Optimal Solid 2 shape: one element binding for every part

One primitive replaces both `useRenderElement` and the three native renderers. Parts declare intent once; the primitive picks the cheapest correct mechanics. The same code runs on client, server and hydration.

```ts
// utils/element/bindElement.ts (sketch)
export interface ElementSpec<State> {
  tag: keyof HTMLElementTagNameMap;           // default element
  template?: () => Element;                   // compiled `<button type="button" tabindex="0" />`; hydratable (claims via getNextElement)
  own: ReadonlySet<string>;                   // part props never forwarded
  literal?: Record<string, unknown>;          // part statics, below consumer keys
  state?: State;                              // getter object; class/style fns receive it
  mapping?: StateAttributesMapping<State>;    // compiled once into a writer table
  attrs?: (set: Set, state: State) => void;   // part attributes that follow reactive sources (aria-*, data-*)
  handlers?: Record<string, PartHandler<State>>; // module-level fns; bound as [dispatch, record] tuples
  refs?: readonly PartRef[];                  // part refs, released with null on dispose
  children?: () => JSX.Element;               // part-owned children; else consumer children
}

export function renderElement<State>(props: object, spec: ElementSpec<State>): JSX.Element;
```

Mechanics, decided once at setup (untracked):

- **Key classification.** One pass over the consumer keys with `isStatic` and `hasStaticKeys`. It works through `merge` proxies too: read the key set once and accept it, or re-classify on a key-set change through a transparent memo only when the source is a proxy. Statics go to `literal`, handlers to dispatch, everything else to `reactive[]`.
- **Grouped binding.** At most one `createRenderEffect(compute, apply, { transparent: true, sync: true })` per element, the same as the compiler's `effect()`. Compute writes part `attrs`, state attributes through a precompiled mapping table (no memo per attribute), reactive consumer keys, class and style into one reused record. Apply diffs per key against `prev` and skips an unchanged string `style`. Transparent means no hydration id. The probe shows it is still exactly 1 node.
- **Handler dispatch tuple.** For each handler key the element gets one module-level dispatcher bound as `[dispatch, record]`, where `record = { props, key, part, gate, state }` is plain data built once. Delegated events go through `_$$click` and `_$$clickData` with no per-element closure. Dispatch order: gate, then `makeEventPreventable`, then the consumer handler read at event time, then the part handler unless `baseUIHandlerPrevented`. This equals `composeHandler` without the closure.
- **`render` prop**, by form:

| form | handling |
|---|---|
| absent | `spec.template()` (cloned on the client, claimed under hydration, `ssr` template on the server) |
| string tag | `dynamic(() => tag, { static: true })`, no memo; bind the produced element |
| `{ component, ...p }` | `createComponent(component, plainProps)`, where `plainProps` is one object with getters for the reactive keys, the binding's `ref` and children; no `<Dynamic>`, no `omit` view |
| function | called once, untracked, with `(plainProps, stateView)`; `plainProps` is the same getter object; the element it returns is bound through `ref` |
| changing `render` (non-static) | the only case that keeps a branch memo; rare, so pay only then |

- **Ref.** Consumer refs applied once, ownerless and untracked (`applyRefs`). Part refs released with `null` on dispose (`releasePartRefs`). There is no layout effect: a part that swaps refs at runtime passes a ref accessor, which the binding reads inside its one effect.
- **Server.** `ssrElement(tag, () => attrs, children, true)`: the same classification and state-attribute table, and the attributes thunk produces exactly what the client binding would write. There is no memo or effect on the server; the client binding is transparent, so the ids line up.
- **Hydration.** The template is claimed via the compiled hydratable template, and the binding is transparent. Attribute writes during `hydrate()` are no-ops (`@solidjs/web` `web.js:518`), so the binding queues one post-hydration reconcile per element: the logic of `useRenderElement.tsx:694–747`, moved into the primitive.
- **Context.** Not part of this primitive. Parts provide context through one transparent `createOwner` plus a single `setContext` record per root (`native/context.ts`). That needs no id, so it is safe on all three sides.

Expected per element on the client: 0 nodes with literal inputs, 1 with any reactive input, plus 1 for reactive children. That is the compiled-JSX floor, on every side, for every part.

## 4. Probe numbers (prototype vs today)

The prototype `bind(el, props, spec)` used `classifyConsumerProps`, one `createRenderEffect(..., { transparent: true, sync: true })`, `assign` with `prev`, `applyRefs` and `insert`:

| shape | nodes beyond plain |
|---|---:|
| bind, literal props only (called directly) | 0 |
| bind, 1 reactive key, transparent | 1 |
| bind, 1 reactive key, non-transparent | 1 |
| compiled `<button title={a()}>` | 1 |
| ProtoButton as a component, literal props | 3 (see the anomaly note) |
| ProtoButton, reactive | 5 |
| Proto Collapsible trigger (beyond the root) | 4 (native 3, slow 16) |

| timing | slow | native | prototype |
|---|---:|---:|---:|
| mount 1000 Button, run A | 32.6 | 6.4 | 7.0 |
| mount 1000 Button, run B | 46.3 | 9.6 | 7.7 |
| update 1000 Button `disabled`, run A | 11.86 | 3.05 | 2.82 |
| update 1000 Button `disabled`, run B | 25.43 | 3.53 | 3.43 |

Findings:
- `transparent: true` costs nothing on the client: the node count is the same as non-transparent, and only the hydration id disappears. That makes one client, server and hydration path free in node terms.
- The prototype matches native timing within noise and is 4–7x faster than the slow path.
- Anomaly, not resolved: the test-file-defined `ProtoButton` component measured 2 nodes more than `bind` called directly, while owner listings inside one render showed only the render root for both. The direct-call rows are the trustworthy floor. Re-measure inside the library (a part file) in 3.1 before setting budgets.

The probe file was deleted. Per the coordinator's later instruction, any re-run must happen in a worktree, never under the main tree's `packages/`.

## 5. Risks for SSR and hydration id order

1. **Switching a family to one path moves ids.** Today the server and hydration use the slow path, with its memos (`useRenderElement.tsx:190`, `:200`, `:388`, `:430`, `:480`), and the client uses native. Moving a part to `renderElement` changes the server's id-consuming owners. Every family must switch server, hydration and client in the same commit, gated by `test/hydration`, `*.hydration.test.tsx`, `test/ssr` and the docs hydration crawl.
2. **Mixed trees.** A slow-path parent and a migrated child are fine only if each side allocates ids identically. The rule: any node created conditionally on `isServer` or `isHydrating()` must be transparent. The new primitive must never branch on `isHydrating()` in a way that changes id-consuming nodes. Today's `canRenderNative` does exactly that branching and goes away.
3. **Elements made with `createNativeElement`** (10 sites) cannot be claimed. They must become compiled templates before their families migrate.
4. **Children inserts** (`scope()` on the client, `ssrGroup` on the server) consume ids. Part-owned versus consumer children must produce the same insert structure on both sides.
5. **`dynamic(..., { static: true })` for string `render`** must be checked on the server: it should emit `ssrElement` with a hydration key, and the client should claim it. Verify with a hydration test before relying on it.
6. **The post-hydration reconcile** (`useRenderElement.tsx:694–747`) runs as a microtask per element today. Moving it into the primitive keeps that behavior, but it must not create owners: it is untracked, uses `queueMicrotask`, and creates no effect.
7. **`onSettled`** consumes an id on both sides. Parts that use it in native code (`createLabelFallback`, `native/index.ts:343`) must call it unconditionally.
8. **The dev component root** wraps every component in dev only. Server and client dev builds must agree. A stale-build or prod/dev mismatch in tests shows up as an id shift, not a functional failure.

## Recommendation for 3.2

- Build `renderElement` first as described in section 3.
- Port Collapsible (Root, Trigger, Panel) to it on all three sides, with failing budgets set at 3.1:
  - Trigger 1 node, plus 1 per reactive input group (dev adds 1);
  - zero hydration-id delta against the compiled-JSX equivalent;
  - server render within 1.5x of direct JSX (`primitive-costs.md` SSR table).
- Retire `canRenderNative` for that family in the same commit.
- Then Accordion. Afterwards, a general `useRenderElement` facade calls `renderElement` for intrinsic static tags, the optimization map's item 1, so the other 150 callers gain without hand-written writers.
