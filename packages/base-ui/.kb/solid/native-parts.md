# Native parts (fast path) — Solid

> Layer: **solid** (the port).
> React reference: [../react/render-element.md](../react/render-element.md) (`useRenderElement`, `mergeProps`).
> Kit: `packages/solid/src/utils/native/` (plain functions, no reactive nodes of their own).

## Status

- **Ported:** partial (plan 8). Native parts so far: `Button`; toggles batch (3.1): `Checkbox.Root/Indicator`, `CheckboxGroup`, `Switch.Root/Thumb`, `Toggle`, `ToggleGroup`, `Radio.Root/Indicator`, `RadioGroup`.
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

- **Toggles batch** (plan 8 3.1, `.kb/components/{checkbox,checkbox-group,switch,toggle,toggle-group,radio,radio-group}.md`):
  part handlers are module-level functions bound per element with `[handler, data]` (gate →
  consumer via `runConsumerHandler` → part → `useButton` after-consumer); attributes split into
  literal (static prop, no context that can flip it) and one render effect; Field attributes only
  inside a Field/LabelableProvider (`fieldAttributes`, `fieldStateAttributes`, `fieldOwnedKeys`);
  label fallback (`getAriaLabelledBy`) from one user effect; composite items through
  `createCompositeItemRegistration` (index guessed from render order); composite roots through
  `renderCompositeRoot`; plain elements through `renderNativeElement`. Conditions: Checkbox/Switch/
  Radio roots need `nativeButton` falsy (and a static `parent`/`inputRef`); Toggle needs
  `nativeButton` true. The three roots keep no closure per attribute group: `createLayout` (the
  classified consumer props, class/style static-ness, part flag bits) feeds module-level
  `<part>Attributes(layout, target, once)` / `<part>Handlers(layout, literal)` functions; the
  literal pass (`once`) writes what can never change, the same function in the render effect the
  rest (`put`, `consumerHas`, `literalClassStyle`, `finishAttributes`). Every native element
  classifies the consumer's props exactly once, through `classifyConsumerProps` (directly, via
  `createLayout`, or via `renderNativeElement`).

- **Disclosure batch (3.2)** — every part renders through `renderNativeElement` (`utils/native/element.ts`:
  literal consumer keys + handler dispatchers once, one owned render effect for the state `data-*`
  (`writeStateAttributes` = `getStateAttributesProps` incl. custom mappers), the part's attributes,
  reactive consumer keys and `class`/`style`; `partStyle` below and `styleOverride` above the
  consumer's style; an unchanged string `style` is not re-written, since Solid's `assign` re-sets
  `cssText` on every run and that would wipe CSS variables a part writes directly). Contexts go on
  one plain owner (`utils/native/context.ts`: `createOwner` + `@solidjs/signals` `setContext`)
  instead of a `<Provider>` (root + lazy children memo + keep-alive render effect). Conditions: the
  contract above; triggers and tabs also need a static, `true` `nativeButton`.
  - `Collapsible.Root`: `<div>`, `useCollapsibleRoot` unchanged; `Accordion.Item`'s root uses
    `alwaysControlled` (its `open` is always its membership in the root's value: no `useControlled`
    memo, `setOpen` a no-op as the controlled mode is).
  - `Collapsible.Trigger` / `Accordion.Trigger`: `useButton` for a focusable-when-disabled native
    button outside a composite root inlined (`wrapDisclosureTriggerHandler`: `onClick` gate →
    consumer → `handleTrigger` unless prevented; `onPointerDown` gate; `onMouseDown`/`onKeyUp`
    dropped while disabled; `onKeyDown` Tab-only while disabled; `writeDisclosureTriggerAttributes`:
    `aria-controls` when open, `aria-expanded`, `aria-disabled`; `type`/`tabindex` from the
    template). The accordion trigger's static `id` is registered from its ref
    (`createIdRegistration`), a reactive one from memo + render effect.
  - `Collapsible.Panel` / `Accordion.Panel`: `useCollapsiblePanel` is created when the panel first
    renders (a closed panel without `keepMounted`/`hiddenUntilFound` never does), owned by the part
    and kept; it receives `initialOpen` (the mount-animation suppression reads the open value the
    panel was created with) and `native: true` (no props memo; the effect reads
    `hiddenAttribute`, `shouldPersistHiddenTransitionStyles`, `shouldPreventOpenAnimation`). The
    measured CSS variables are written once the flush settles (ownerless `onSettled`), after every
    panel measured, so 300 opening panels lay out once (React applies its dimension state after all
    layout effects; measured: both libraries force exactly one layout and two style recalcs per
    open-all). The conditional element is `createNativeConditional` (`utils/native/conditional.ts`):
    an accessor the parent's insert tracks, the branch a root owned by the part — no node while hidden.
    The hook's graph (iteration 6): React's three passive effects (measure, `useOpenChangeComplete`,
    close) are one `createEffectGroup` node (`utils/native/effectGroup.ts`: each part keeps its own
    dependency snapshot, apply condition and cleanup); `forcePanelIdle` is a plain signal the
    measuring part clears as soon as it sees the root status leave `'starting'` (it runs on every
    status change, always before the next `'starting'`, which needs an open flip); the element is a
    plain box on the native path (attached synchronously while the branch renders, before any
    effect created there runs) and the effects read it when they apply, as React reads
    `ref.current`; the dimension re-apply of React's layout effect runs from the ref on attach and
    at the start of every measuring pass (every `mounted` change comes with an open or status
    change); the two animations-finished watchers are created on first use. Per rendered panel:
    branch root, attribute effect, children insert, one signal, one effect node (plus the root's
    transition status: 2 signals + 1 effect node, created on first open).
  - `Accordion.Root` / `Tabs.Root`: `<div>` + context owner; the item/panel list stays
    `CompositeList` (`createComponent`). `Accordion.Item`: two context owners, lean list
    registration with an index guessed from creation order (`createNativeListItem`, confirmed by
    the list's flush; no post-flush re-render of its 4 elements). `Accordion.Header`: `<h3>`.
  - `Tabs.List`: `CompositeRoot`'s composition (useCompositeRoot, CompositeRootContext,
    CompositeList) with the `<div>` native; `CompositeRoot` itself untouched.
  - `Tabs.Tab`: `useButton` + `useCompositeItem` for a native composite item inlined: `tabindex`
    from the highlight, `aria-disabled`, `aria-selected`, `aria-controls`, `id`, the active item
    attribute; `onClick`/`onPointerDown` behind the disabled gate; `onFocus` = tab activation then
    the composite highlight; `onKeyDown` Tab-only guard while disabled, then the consumer, then
    `useButton`'s composite Space activation (`preventDefault` + `preventBaseUIHandler` +
    `dispatchClickWithModifiers`); `onKeyUp` cancels Space's keyup activation regardless of
    `preventBaseUIHandler` (as `useButton`); the capture-phase `keydown` listener sets the
    navigation flag. Static `id`/`value`/`disabled` → one metadata object; the highlight sync is one
    effect that compares its dependency snapshot itself.
  - `Tabs.Panel`: a hidden panel creates its list registration when it first renders and its
    transition status (`animateInitialOpen = !initialOpen` keeps `'starting'` on its first open)
    with the inlined `useOpenChangeComplete` effect when it first opens (the eager hook's initial
    run on a closed panel has no effect); a statically kept-mounted panel with a static value is
    registered with the root from its ref and unregistered with the part (no node), otherwise the
    registration effect is created with the list registration. `Show` only until it renders.
  - `Tabs.Indicator`: `<span>`, measurement memos unchanged; the CSS variables are a `partStyle`.
  - Recorded divergences from the slow path: none in DOM/handler order (parity tests
    `collapsible/Collapsible.parity.test.tsx`, `accordion/Accordion.parity.test.tsx`,
    `tabs/Tabs.parity.test.tsx` compare whole trees after each interaction).

## Known issues / TODOs

- `utils/useRenderElement.stableProps.test.tsx` requires a part to read its slow-path `props` at
  least once; native parts never build that view (plan 8 journal, 3.2 open issue).
- Kit additions from 3.2 to fold into `index.ts` when the batches are consolidated:
  `element.ts` (generic renderer), `context.ts`, `listItem.ts`, `registration.ts`,
  `conditional.ts`, `dedupe.ts`, `effectGroup.ts`, `parityHarness.tsx` (test helper). `useTransitionStatus` creates its frame effects (one
  `createEffectGroup` node) on first open/mount (shared util; behavior unchanged).

- Spread props (`$PROXY`) and reactive `render`/`ref` keep the slow path; step 3 batches may widen
  `canRenderNative` once a case is measured to matter.
- SSR/hydration native templates: plan 8 step 5.

## Files (target)

- `packages/solid/src/utils/native/index.ts` — kit
- `packages/solid/src/utils/native/parity.test.tsx` — slow vs native parity harness
- `packages/solid/src/utils/native/native.cost.test.tsx` — node budgets
- `packages/solid/src/button/Button.tsx` — first native part
- `packages/solid/src/utils/native/element.ts`, `context.ts`, `listItem.ts`, `registration.ts`, `conditional.ts`, `dedupe.ts`, `effectGroup.ts` — 3.2 kit additions
- `packages/solid/src/collapsible/`, `accordion/`, `tabs/` — disclosure batch (3.2)

## Test commands

```bash
VITEST_ENV=jsdom npx vitest run --project @solidports/base-ui packages/solid/src/utils/native packages/solid/src/button
VITEST_ENV=chromium npx vitest run --project @solidports/base-ui --maxWorkers=1 packages/solid/src/button
```
