---
tags: [render, native, props, perf]
sources: [packages/base-ui/packages/solid/src/utils/native/serverElement.ts, packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/propsView.ts, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/consumer.ts, packages/base-ui/packages/solid/src/merge-props/mergeProps.ts, packages/base-ui/packages/solid/src/utils/renderPath.ts]
verified: 2026-10-17
---

# Render pipeline

Every part renders through `useRenderElement` (the slow path: lazy props-view proxies, per-key effects) unless it is one of 30 native-kit files that render direct DOM when `canRenderNative` allows. Both paths must produce identical DOM and handler order.

## Slow path: `useRenderElement`

`src/utils/useRenderElement.tsx` (re-exported from `internals/`) returns a component; an `enabled` that can change wraps it in `<Show>`, while a fixed one (a boolean, or absent) is chosen once. Parts return `element()` itself, not `<>{element()}</>`: a list's parent resolves every accessor layer a row returns and tracks each one, and the fragment compiles to one more memo.

### Props sources

Element props are one `createPropsView` over sources, lowest priority first (`computeSources`, `:410`): tag defaults (`type="button"`, `alt=""`), props passed to the returned component, state attributes, `params.props` (flattened; a function entry receives a view of the entries before it and its result replaces them, as React `mergeProps`), a `render={{ component, ...props }}` config, then `class`/`style` resolved against state. `component` is omitted from every view.

### `propsView.ts`

- `createPropsView` is a Proxy whose `get` walks sources last to first per key, so a read tracks only that key. The key list is a lazy transparent memo (no hydration id), created on first enumeration.
- Last source wins, even explicit `undefined`; `class`, `style`, `classList` combine; `on*` chains case-insensitively; `tabIndex`/`tabindex` resolve as one key.
- `isStaticPropsViewKey` asks the answering source through Solid's `isStatic`; merged keys, handlers, and accessor sources are never static.
- State attributes read `state[key]` directly for default `data-*` mapping; each custom mapper gets one transparent memo per state key. A plain `state` object and mapping fix the layout once.

### Handler order

`chainHandlers` (`propsView.ts:181`) runs the highest-priority handler first, then each lower one unless `event.baseUIHandlerPrevented` is set, so a consumer calling `event.preventBaseUIHandler()` skips the part's handler. Handlers run untracked. The public `mergeProps` (`merge-props/mergeProps.ts`) uses the same order; `{ callAllHandlers: true }` runs all and returns the first defined result. Merged refs expose `MERGED_REFS` so each callback is applied once.

### `render` prop forms

| Form | Handling |
| :--- | :--- |
| absent or static non-function | Read once, no memo. |
| string tag | Validated against `TAG_NAME_PATTERN`; becomes the tag. |
| `{ component, ...props }` | `component` is the tag; the rest merges above part props; `children` and `ref` honored. |
| function `(props, state)` | Called in a tracked branch: top-level reads re-run it, reads inside its JSX update in place. The native path's memo (below) keeps these semantics. |
| rendered element (`render={<div />}`) | Rejected: a DOM node has no props to merge. Dev throws `invalid-render-prop`. |

### Nodes per element

- Static tag, `render`, and `params.props` on a non-hydrating client: no source memos; `dynamic(() => tag, { static: true })` renders directly; literal text children skip the children memo.
- Intrinsic element: `hostRef` creates a root under the module-level `attributeRootOwner` (`:597`) holding one structure render effect over the key set (`:631`). Handlers get stable dispatchers and static values are assigned once; every other key gets its own render effect (`:676`).
- Refs: a layout effect re-syncs only when a ref source can change (`:468`). Part refs get React's `null` on cleanup; consumer callback refs never do.
- Dynamic `render`, accessor tag, server, or hydration: up to three source memos, a branch memo, and `<Dynamic>` for component tags, server renders and hydration. A string tag on the client outside hydration renders through `dynamic(() => tag, { static: true })` inside the branch, so a list's parent tracks one source per row (`useRenderElement.fanIn.test.tsx`). The `isHydrating()` branch is id-safe: hydration renders `<Dynamic>` as the server does, and a run outside hydration claims nothing, so its owners need not match.
- Hydration: a microtask re-applies attributes skipped during `hydrate()` and removes stale server attributes, keeping form-state ones (`:694`).

## Native kit: `utils/native/`

### `canRenderNative(props, staticKeys, ssr, render)` (`native/index.ts`)

Decided once at setup. True only when all hold:

1. `!isServer && !isHydrating()`, unless the part passes `ssr` (its native path renders on the server and hydrates);
2. `props[$PROXY]` is falsy (no spread or merged props);
3. `ref` is static (absent counts);
4. no `render` key, unless the part passes a `render` check and the value passes it. The value must be static, except in parts that pass `dynamicRender` (Collapsible's and Accordion's Trigger and Panel, plan 3 leaf 5.1.2b). There a reactive `render`, which the compiler makes of any expression but a literal or an identifier (a wrapper's `render={props.render}`, `render={cond() ? a : b}`), renders natively when its current value passes the check: the server renders the value once, and the client renders it under one transparent branch memo that re-renders the element when the value changes. That is one memo per part, plus the parent's insert where the static form returns the part's own element. A later value the native path cannot render warns in development. A re-evaluation to the same value re-renders the element too: a memo's re-run disposes what its last run created, so the memo cannot hand back the old element. That takes a dependency that changes without changing the value, which a forwarded `render` does not have. In every other part a reactive `render` falls back;
5. every key in `staticKeys` is static.

Parts add conditions; `Button` also needs no composite root and a static, `true` `nativeButton` (`button/Button.tsx:41`).

### Render forms on the native path (plan 3 leaf 5.1.2)

Collapsible's and Accordion's Trigger and Panel pass `isNativeRender` (the Triggers `isNativeButtonRender`, which keeps a tag to `button`, their element's semantics) and render every static `render` value natively (`native/element.ts`, `renderWithRender`):

| Form | Native handling |
| :--- | :--- |
| tag, or `{ component: 'tag', ...props }` | The part's element, created by tag (`getNextElement()` while hydrating, one hydration key as a compiled template takes) and rendered as without `render`; the part returns the element itself. |
| `{ component: Component, ...props }` | `createComponent(Component, props)` with the part's props object (below). |
| render function `(props, state)` | Called with the part's props object and state from its own transparent memo; the part returns the memo. |
| a config with handlers, `ref`, `children` or getters | Falls back: the slow path chains or inserts those. |

- A config's other props are the top layer, above the part's and the consumer's (React merges `render.props` last), a part's own keys such as a panel's `id` included; its `class` comes after the consumer's resolved class and its `style` sits below the consumer's, as the props view combines them.
- The props object a component or function receives is plain: literal attributes and handler dispatchers are data properties; everything that can change is a getter over one transparent memo holding the part's write, which replaces the part's attribute effect. The consumer's spread is the only binding, and the ref is only the ref, so a component that drops the ref still gets every attribute and handler (development's render-path mark, set through the ref, is then absent). Static children stay data properties, so the consumer's spread inserts them without a computation.
- The render function's memo is needed: a parent resolves all its children in one computation, so a function called directly there would re-run, re-creating its element, for any sibling's top-level reads, and while hydrating it would run under another owner path and miss the server's element. Cost beyond the function's own element: the memo, plus, for a part its parent inserts directly (a Trigger), the computation a parent's insert adds for any accessor child; a Panel's own conditional already resolves its accessor.

### Rules

- `classifyConsumerProps` (`native/consumer.ts`) runs once: own and reserved keys (`class`, `style`, `render`, `ref`, `children`) are skipped; `on*` keys get a dispatcher that reads the handler at event time; static values are assigned once; getters are read in the attribute effect.
- Priority matches the slow path; a consumer key wins, even `undefined`.
- At most one owned render effect, writing through `assign(el, props, true, prev, true)`.
- `composeHandler`: optional part gate, consumer, then part unless prevented. Module-level handlers bind with `[fn, data]` tuples.
- Consumer refs apply once (`applyRefs`); part refs also get `null` on dispose (`releasePartRefs`).
- Contexts on one transparent owner (`native/context.ts`). Helpers: `createNativeConditional`, `createEffectGroup`, `createIdRegistration`, `createNativeListItem`, `createCompositeItemRegistration`.
- `createNativeElement` uses `document.createElement`, not a template clone.
- A consumer key a template's literal attributes hold (`type`, `tabindex`, or `tabIndex`) wins, even `undefined`: the element comes from its bare tag and the template's other literals become part literals below the consumer's props. On the server a consumer key that names an attribute in another case (`tabIndex`) replaces the template or literal attribute of that name, and the part's writes skip it (`test/ssr/native-element.test.ts`).
- Server (`native/element.ts`): the part's own writes become one markup string (`takeServerMarkup`); the template, consumer, class and style keys stay in a copy-on-write object, and the kit's writer (`native/serverElement.ts`) renders the element with both, its children escaped as compiled JSX escapes them. The writer writes what `ssrElement` would for a plain object, byte for byte (`test/ssr/serverElement.test.ts`), with a template's literals serialized once, and hands children to the same tail `ssrElement` uses (`ssr` and `resolveSSRNode` for anything but a string or a plain node). Void, raw, form and link tags, child properties in the object, and slot or claims renders keep `ssrElement`. D13's earlier writer, which handed several children back to `ssrElement`, was measured and removed.
- Hydration (`native/element.ts`): the first write stands for the server markup (development checks it, skipping the spec's `scriptedAttributes`, which a prehydration script may already have changed: Tabs.Indicator's `style` and `hidden`; once `hydrate()` returns, those but `style` reconcile against the element, so a script that showed what the client hides is undone) and is kept by reference. An element reconciles after `hydrate()` returns only when its attribute effect applied again while hydrating (Solid records such writes without making them) or its spec sets `reconcileAfterHydration` (a panel with its machinery, whose measured animation type is a plain variable). Every such element reconciles in one shared microtask; the others queue nothing and write nothing (`hydrationCost.test.tsx`). Contract, as compiled JSX and React's hydration: an attribute the client computes differently from the server (an environment read: media query, locale, platform) keeps the server's value on a hydrated element. A part that needs the client's value makes it reactive and changes it after hydration, so its effect writes it.

Two renderers coexist: `renderNativeElement(spec)` in `native/index.ts` (`CheckboxGroup`, `RadioGroup`) takes a part-built writer. `renderNativeElement(el, props, spec)` in `native/element.ts` (Button, Collapsible, Accordion, Tabs, Separator, the Progress and Meter Tracks and Indicators) writes state attributes itself and skips re-writing an unchanged string `style`, since `assign` resets `cssText` and would wipe CSS variables a part set. Checkbox, Radio, and Switch roots use `createLayout` with module-level attribute functions.

### Coverage

Native families: Button, Toggle, ToggleGroup, Checkbox (Root, Indicator), CheckboxGroup, Switch (Root, Thumb), Radio (Root, Indicator), RadioGroup, Collapsible, Accordion, Tabs, Separator, Progress (Track, Indicator), Meter (Track, Indicator). Of the 172 non-test files calling `useRenderElement(`, 145 have no native path.

Guards: `utils/native/parity.test.tsx`, the ten per-family `*.parity.test.tsx` files (Accordion, Checkbox, Collapsible, Meter, Progress, Radio, Separator, Switch, Tabs, Toggle), the `utils/native/*.cost.test.tsx` budgets, and `useRenderElement.stableProps.test.tsx`.

## Node counts

Reactive nodes per instance. Dev-mode probe, 2026-10-14, Solid rc.13; re-measure on rc.15 before relying on exact values.

| Part | Native | Slow |
| :--- | ---: | ---: |
| Button | 2 | 11 |
| Toggle | 6 | 27 |
| Checkbox + Indicator | 20 | 55 |
| Switch + Thumb | 13 | 57 |
| Collapsible closed / open | 12 / 18 | 47 / 73 |
| Accordion.Item | 14 | 84 |
| Tabs.Tab | 3 | 27 |

A `{...props}` wrapper fails `canRenderNative`: Button then costs 15, Checkbox 58. The fall back is silent and both paths render the same DOM, so a test meant for the native path can pass on the slow one. In development, `src/utils/renderPath.ts` records the path that rendered each part's element (`attachNativeAttributes` marks `native`, `useRenderElement`'s ref marks `slow`), and the test utils assert it: `expectNativePath(...elements)`, `expectSlowPath(...elements)` and `expectNoSlowPath(container)`. The native cost tests, the hydration literal checks and the D9/D11 panel tests use them. See [perf method](../perf/method.md), [primitive costs](../solid/primitive-costs.md), and [SSR and hydration](ssr-hydration.md).
