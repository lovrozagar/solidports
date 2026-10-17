---
tags: [render, native, props, perf]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/propsView.ts, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/consumer.ts, packages/base-ui/packages/solid/src/merge-props/mergeProps.ts, packages/base-ui/packages/solid/src/utils/renderPath.ts]
verified: 2026-10-17
---

# Render pipeline

Every part renders through `useRenderElement` (the slow path: lazy props-view proxies, per-key effects) unless it is one of 30 native-kit files that render direct DOM when `canRenderNative` allows. Both paths must produce identical DOM and handler order.

## Slow path: `useRenderElement`

`src/utils/useRenderElement.tsx` (re-exported from `internals/`) returns a component; `enabled` wraps it in `<Show>`.

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
| function `(props, state)` | Called in a tracked branch: top-level reads re-run it, reads inside its JSX update in place. |
| rendered element (`render={<div />}`) | Rejected: a DOM node has no props to merge. Dev throws `invalid-render-prop`. |

### Nodes per element

- Static tag, `render`, and `params.props` on a non-hydrating client: no source memos; `dynamic(() => tag, { static: true })` renders directly; literal text children skip the children memo.
- Intrinsic element: `hostRef` creates a root under the module-level `attributeRootOwner` (`:597`) holding one structure render effect over the key set (`:631`). Handlers get stable dispatchers and static values are assigned once; every other key gets its own render effect (`:676`).
- Refs: a layout effect re-syncs only when a ref source can change (`:468`). Part refs get React's `null` on cleanup; consumer callback refs never do.
- Dynamic `render`, accessor tag, server, or hydration: up to three source memos, a branch insert, and `<Dynamic>` for component tags and server renders.
- Hydration: a microtask re-applies attributes skipped during `hydrate()` and removes stale server attributes, keeping form-state ones (`:694`).

## Native kit: `utils/native/`

### `canRenderNative(props, staticKeys)` (`native/index.ts:65`)

Decided once at setup. True only when all hold:

1. `!isServer && !isHydrating()`;
2. `props[$PROXY]` is falsy (no spread or merged props);
3. `'render' in props` is false (even `render={undefined}` falls back);
4. `ref` is static (absent counts);
5. every key in `staticKeys` is static.

Parts add conditions; `Button` also needs no composite root and a static, `true` `nativeButton` (`button/Button.tsx:41`).

### Rules

- `classifyConsumerProps` (`native/consumer.ts`) runs once: own and reserved keys (`class`, `style`, `render`, `ref`, `children`) are skipped; `on*` keys get a dispatcher that reads the handler at event time; static values are assigned once; getters are read in the attribute effect.
- Priority matches the slow path; a consumer key wins, even `undefined`.
- At most one owned render effect, writing through `assign(el, props, true, prev, true)`.
- `composeHandler`: optional part gate, consumer, then part unless prevented. Module-level handlers bind with `[fn, data]` tuples.
- Consumer refs apply once (`applyRefs`); part refs also get `null` on dispose (`releasePartRefs`).
- Contexts on one transparent owner (`native/context.ts`). Helpers: `createNativeConditional`, `createEffectGroup`, `createIdRegistration`, `createNativeListItem`, `createCompositeItemRegistration`.
- `createNativeElement` uses `document.createElement`, not a template clone.
- Server (`native/element.ts`): the part's own writes become one markup string (`takeServerMarkup`); the template, consumer, class and style keys stay in a copy-on-write object, and `ssrElement` renders the element with both, its children escaped as compiled JSX escapes them. Writing the markup without `ssrElement` was measured and removed (D13): most native elements have several children, which only `ssrElement`'s node walk resolves byte for byte.
- Hydration (`native/element.ts`): the first write stands for the server markup (development checks it) and is kept by reference. An element reconciles after `hydrate()` returns only when its attribute effect applied again while hydrating (Solid records such writes without making them) or its spec sets `reconcileAfterHydration` (a panel with its machinery, whose measured animation type is a plain variable). Every such element reconciles in one shared microtask; the others queue nothing and write nothing (`hydrationCost.test.tsx`). Contract, as compiled JSX and React's hydration: an attribute the client computes differently from the server (an environment read: media query, locale, platform) keeps the server's value on a hydrated element. A part that needs the client's value makes it reactive and changes it after hydration, so its effect writes it.

Two renderers coexist: `renderNativeElement(spec)` in `native/index.ts` (`CheckboxGroup`, `RadioGroup`) takes a part-built writer. `renderNativeElement(el, props, spec)` in `native/element.ts` (Collapsible, Accordion, Tabs, Separator, the Progress and Meter Tracks and Indicators) writes state attributes itself and skips re-writing an unchanged string `style`, since `assign` resets `cssText` and would wipe CSS variables a part set. Checkbox, Radio, and Switch roots use `createLayout` with module-level attribute functions.

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
