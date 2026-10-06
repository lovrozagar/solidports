# Native parts (fast path) — Solid

> Layer: **solid** (the port).
> React reference: [../react/render-element.md](../react/render-element.md) (`useRenderElement`, `mergeProps`).
> Kit: `packages/solid/src/utils/native/` (plain functions, no reactive nodes of their own).

## Status

- **Ported:** partial (plan 8). Native parts so far: `Button`.
- **Verified:** parity test `utils/native/parity.test.tsx`, cost budget `utils/native/native.cost.test.tsx`,
  the part's own tests (both paths), the plan-7 gate (`.tmp/grunt/plan7-baseline/GATE.md`).
- **Last reviewed:** 2026-10-06

## Why

The React port turned every hook into a Solid reactive node (memo/signal/effect) and rendered every
element through `useRenderElement` (props views, proxies, a root per element). React hooks are
near-free slots; Solid nodes cost allocation, graph wiring and disposal, so Solid lost creation and
disposal (Button ~11 nodes, React 0). A native part renders its element with direct JSX and binds
only what can change. The slow path (`useRenderElement`) stays for everything it alone can express.

## When a part may take the fast path

The choice is made **once, at setup, from static information** (`canRenderNative(props, options)`):

1. Client render that is not hydrating: `!isServer && !isHydrating()`. The server and the hydration
   render keep the slow path, so server HTML and hydration keys are unchanged (plan 8 step 5 moves
   SSR to native templates separately).
2. No `render` key on the props at all (`'render' in props` is false). A `render` prop that is
   present, even `undefined` or reactive, keeps the slow path (render functions, string tags,
   config objects, elements all stay fully supported there).
3. The props object is not a Solid proxy (`props[$PROXY]`): a part receiving `{...spread}` props has
   a key set that can change, which the fast path does not follow.
4. `ref` is static (Solid's `isStatic`; an absent key counts as static): the compiled
   `let el; <Part ref={el} />` form and plain callbacks/object refs qualify, a `ref={signal()}`
   getter does not.
5. Every key the part reads once (`options.staticKeys`, e.g. `nativeButton`) is static.
6. Part-specific conditions (recorded per part below), e.g. Button: not inside a composite root.

Anything else: `useRenderElement`, unchanged. Both paths are covered by the same tests; the parity
harness renders the same props through both (`render="<tag>"` forces the slow path on the same tag).

## What the fast path must preserve

### Attributes (`nativeAttributes`)

Effective props, lowest priority first, exactly as the slow path's source order:

1. tag defaults (`type="button"` for `<button>`, `alt=""` for `<img>`);
2. state attributes: `data-<key>` per state key, `''` for `true`, the string for other truthy
   values, absent otherwise (custom mappers as `getStateAttributesProps`);
3. the part's own attributes (e.g. `useButton`'s `type`/`role`, `tabindex`, `aria-disabled`,
   `disabled`);
4. the consumer's props (every key except `class`, `style`, `render`, `ref`, `children` and the
   part's own props) — a consumer key overrides the part's, including `undefined`;
5. `class` and `style` resolved against the part's state (`resolveClass`, `resolveStyle`: function
   forms receive the state object; a part style is combined below the consumer's).

Classification per consumer key (once, untracked):

- `on*`: one stable dispatcher per key, assigned once. It reads the consumer's handler **at event
  time** (untracked), accepts a function, a `[handler, data]` tuple, or the lowercase form
  (`onclick`), and calls `makeEventPreventable` first. Handlers never subscribe to anything.
- literal values (`isStatic(props, key)`): assigned once at attach, no computation.
- reactive values (getters): read inside **one** render effect together with the state attributes,
  the part's reactive attributes and `class`/`style`; the effect writes through Solid's
  `assign(el, props, true, prev, true)`, so attribute/property/`class`/`style` semantics are the
  runtime's own and identical to the slow path. A part whose inputs are all literal creates no
  effect at all. The effect is owned by the part (disposed with it) and never writes on dispose
  (React leaves the detached element as it was).

Static attributes therefore cost 0 reactive nodes; a part's budget counts its effect (0–1) plus its
children insert (0 for a literal string/number child, 1 otherwise).

### Handlers (`composeHandler`)

React's `mergeProps` order: the consumer's handler runs first, then the part's, unless the consumer
called `event.preventBaseUIHandler()` (`event.baseUIHandlerPrevented`). A part that gates the
consumer (React prop getters: `useButton` returns before calling the consumer when `disabled`)
expresses that gate before `next(event)`; logic React runs after the consumer runs after
`next(event)` (`buttonKeyDownAfterConsumer`, `buttonKeyUpAfterConsumer` in `use-button`). Solid's
event delegation is kept as the slow path keeps it (`assign` registers `on*` through the same code).

### Refs (`applyRefs`, `releasePartRefs`)

- Each distinct consumer callback ref is called once with the element (never with `null`: Solid's
  contract); `mergeProps`-chained refs (`MERGED_REFS`), arrays and object refs (`{ current }`) are
  flattened by `collectRefs`.
- Part refs (`params.ref` of the slow path) are called with the element on attach and with `null`
  on unmount: the ported registration hooks rely on React's `null` call. Object part refs are
  cleared only when they still point at the outgoing element.

### Children

`children` from the consumer props: a literal string/number is inserted directly (no node); a
getter gets Solid's `insert` effect. Parts that own their children (`params.children` on the slow
path) pass them explicitly.

### State

The state object is the part's own `{ get key() {} }` object: `class`/`style` functions receive it
(reads inside them track inside the attribute effect), `data-*` come from it.

### Field, composite and popup integration

Field parts (`aria-labelledby`, validation, touched/dirty/filled), composite items (CompositeList
index order, `updateDisabled`) and popup triggers keep their hooks; a native part inlines only what
the hook returns for the native case and keeps the hook's registration side effects. Where that is
not possible without a reactive node the part stays on the slow path for that configuration
(recorded below).

## Per-part conditions and parity notes

- **Button** (`button/Button.tsx`): fast path when the contract above holds and
  `useCompositeRootContext(true) == null`; `nativeButton` static and `true` (a non-native button
  without `render` is a misuse that keeps the slow path and its dev warning). Inlined from
  `useButton`/`useFocusableWhenDisabled` for the non-composite native case: `type="button"` and
  `tabindex="0"` in the cloned template (assigned instead when the consumer sets either),
  `aria-disabled` (`'true'`/`'false'`) when `focusableWhenDisabled`, `disabled` otherwise,
  `data-disabled` from the state. Handlers: `onClick`/`onPointerDown` call `preventDefault` and stop
  when disabled, `onMouseDown`/`onKeyUp` drop the consumer's handler when disabled, `onKeyDown`
  keeps only Tab while disabled and focusable. The after-consumer keyboard logic of `useButton` is
  a no-op for a native non-composite button (the browser activates it), so nothing runs after the
  consumer. Without a consumer handler the gates are shared module functions bound per element with
  Solid's `[handler, data]` form (no closure per button). Recorded, not replicated: a lowercase-only
  `onclick` makes the slow path's handler lookup skip the part's camel-case gate (view quirk); the
  native path keeps the gate.

## Known issues / TODOs

- Spread props (`$PROXY`) and reactive `render`/`ref` keep the slow path; step 3 batches may widen
  `canRenderNative` once a case is measured to matter.
- SSR/hydration native templates: plan 8 step 5.

## Files (target)

- `packages/solid/src/utils/native/index.ts` — kit
- `packages/solid/src/utils/native/parity.test.tsx` — slow vs native parity harness
- `packages/solid/src/utils/native/native.cost.test.tsx` — node budgets
- `packages/solid/src/button/Button.tsx` — first native part

## Test commands

```bash
VITEST_ENV=jsdom npx vitest run --project @solidports/base-ui packages/solid/src/utils/native packages/solid/src/button
VITEST_ENV=chromium npx vitest run --project @solidports/base-ui --maxWorkers=1 packages/solid/src/button
```
