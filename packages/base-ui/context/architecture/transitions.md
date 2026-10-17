---
tags: [transitions, animation, collapsible, state]
sources: [packages/base-ui/packages/solid/src/utils/useTransitionStatus.ts, packages/base-ui/packages/solid/src/utils/createLazyTransitionStatus.ts, packages/base-ui/packages/solid/src/utils/useUnmountAfterClose.ts, packages/base-ui/packages/solid/src/utils/useOpenChangeComplete.tsx, packages/base-ui/packages/solid/src/utils/useAnimationsFinished.ts, packages/base-ui/packages/solid/src/utils/useAnimationFrame.ts, packages/base-ui/packages/solid/src/collapsible/root/useCollapsibleRoot.ts, packages/base-ui/packages/solid/src/collapsible/panel/useCollapsiblePanel.ts, packages/base-ui/packages/solid/src/internals]
verified: 2026-10-17
---

# Transitions

Open/close animation runs on a four-value `transitionStatus` machine (`useTransitionStatus`), an animations-finished watcher (`useAnimationsFinished`) and, for Collapsible and Accordion panels, a measuring orchestrator in `useCollapsiblePanel`. Status changes are derived in the same flush as `open`; frame callbacks and `getAnimations()` decide when an element may unmount.

## Where the code lives

- Implementations are in `packages/base-ui/packages/solid/src/utils/`. The `internals/` files of the same name (`useTransitionStatus.ts`, `useOpenChangeComplete.tsx`, `useAnimationsFinished.ts`, `useTriggerSwitchTransition.ts`) are one-line re-exports, because upstream React moved them to `packages/base-ui/packages/react/src/internals/`. Import from either; edit `utils/`.
- `internals/TransitionStatusDataAttributes.ts` holds the attribute names (`data-starting-style`, `data-ending-style`). `utils/stateAttributesMapping.ts` exports `transitionStatusMapping`, which Collapsible merges with `utils/collapsibleOpenStateMapping.ts` in `collapsible/root/stateAttributesMapping.ts`.
- Consumers: about 18 component families call `useTransitionStatus` (popups, Collapsible, Accordion, Tabs, Checkbox and Radio indicators, Avatar, Toast, Field). See the [render pipeline](./render-pipeline.md) for how status becomes attributes.

## The status machine

| Value | Meaning | Attribute |
| :--- | :--- | :--- |
| `starting` | Mounted, not yet painted with the open style | `data-starting-style` |
| `idle` | Open and settled (only with `enableIdleState`) | none |
| `ending` | `open` is false, element still mounted, exit animation runs | `data-ending-style` |
| `undefined` | Closed and unmounted, or open without the idle state | none |

Signature: `useTransitionStatus(open, enableIdleState?, deferEndingState?, animateInitialOpen?, canStayMounted?)`, all `MaybeAccessor`. It returns `{ mounted, setMounted, transitionStatus }`.

- `mounted` and `transitionStatus` are function-form `createSignal`s (writable computeds). They re-derive when `open` changes and keep values written by frame callbacks or `setMounted` until the next input change. React sets them during render; copying them from an effect would render one flush with a stale status.
- `setMounted(false)` bumps an unmount-request signal that the `mounted` computed reads, so a reopen in the same flush still wins, as React's `open && !mounted` does.
- An element that mounts already open skips `starting` (goes to `idle`, or `undefined` without the idle state) unless `animateInitialOpen` is set.
- Two frame effects run in one `createEffectGroup` node: the deferred `ending` (one `AnimationFrame` after close when `deferEndingState`) and the `starting` → `idle` step. They are created lazily, through `runInLazyScope`, the first time the element is open or mounted, so a closed element pays for two computeds only.
- `starting` → `idle` uses `requestAfterPaint`: a `setTimeout` queued from a rAF. Solid 2 flushes a write in the rAF callback itself, before style recalc, so a plain rAF would remove `data-starting-style` before the browser ever styled it and CSS transitions would never start.

## Animations finished

`useAnimationsFinished(element, waitForStartingStyleRemoved?, batch?)` returns `run(callback, signal?)`:

- Returns at once when the element has no `getAnimations` or `globalThis.BASE_UI_ANIMATIONS_DISABLED` is set (tests use this).
- Waits one frame (or, with `waitForStartingStyleRemoved`, for a `MutationObserver` to see `data-starting-style` removed), then `Promise.all` over `getFiniteAnimations(element)` (infinite animations excluded). A rejected promise re-checks for replacement animations.
- The callback runs inside `flushSync` (`utils/flushSync.ts`, a wrapper over Solid `flush`) so unmount commits before paint. With `batch`, completions ready in one microtask share a single flush.

`useOpenChangeComplete({ open, ref, enabled?, batch?, onComplete })` wraps it in one `createEffect` keyed on `open` and `enabled`, aborting the run on change and dropping a completion whose `open` no longer matches.

## Lazy machinery for parts that start closed

`createLazyTransitionStatus` (`utils/createLazyTransitionStatus.ts`) is the one implementation for parts that start closed and may never open: checkbox and radio indicators, the Collapsible root, and every popup through `useUnmountAfterClose` (`useOpenStateTransitions` for the popup roots, and Select, Combobox and NavigationMenu directly).

- The status machine and any extra machinery (`onCreate`: a popup's unmount effect and close-completion hook) are created in a lazy scope of the caller's owner on the first open a reader of `mounted` or `transitionStatus` sees. Every caller reads `mounted`, since it decides what renders. Until then `mounted` is false, the status `undefined`, and a popup's `forceUnmount` does nothing.
- That first open enters `'starting'`, as an instance created at mount does. A part that mounts open creates it at once, with `animateInitialOpen` deciding `'starting'`.
- The lazy scope takes no slot of the owner, so hydration ids stay aligned. On the server the part renders once, and a stand-in returns the initial status `useTransitionStatus` would (D9).
- A closed popup root saves 4 nodes this way (plan 3, 4.8): its two status memos, its unmount effect and its close-completion hook.

## Collapsible panel orchestration

Root (`useCollapsibleRoot.ts`):

- A root that starts closed creates no transition machinery. Its first open creates `useTransitionStatus(open, true, true, true)` lazily; an initially open root creates it eagerly with `(open, true, true)`.
- `handleTrigger` only calls `onOpenChange` (with reason `triggerPress`) and `setOpen`. `mounted` follows `open` inside the status machine, so there is no eager `setMounted` and no `batch`. Accordion items pass `alwaysControlled` to skip `useControlled`.

Panel (`useCollapsiblePanel.ts`):

- The panel element is a signal (a plain box for native panels). Long-lived state lives in closure variables, not refs: `animationTypeRef`, `dimensionsRef`, `shouldSkipNextOpenRef`.
- `getAnimationType` reads `getComputedStyle` each measuring pass and returns `css-transition`, `css-animation` or `none`. Both together warns in dev and is treated as a transition.
- One `createEffectGroup` holds four parts: measure (on `open`, status and suppression), keyframe suppression on `animationend`, the inlined open-complete watcher (clears dimensions to `auto` once `open && mounted && idle` animations finish), and the close watcher (waits one frame after `ending`, then for animations, then `setMounted(false)`).
- Measured sizes are written straight to `--collapsible-panel-height` and `--collapsible-panel-width`, batched across panels in one `onSettled` per flush to avoid a layout per panel.
- On close the panel measures, then `queueMicrotask(flushStyle)` forces style so the transition starts from pixels, because Solid commits the deferred `ending` frame before the next style recalc.
- `none` closes unmount at once. A detached or missing element also finishes the close.
- `hidden="until-found"` renders as a string through the `hidden` prop. The `beforematch` listener is attached from the ref, opens with reason `none`, removes `data-starting-style` synchronously, and skips motion for that open with a temporary `0s` duration. A canceled or ignored reveal restores `hidden` in a later frame.
- Initially open keyframe panels suppress their open animation until first closed. Solid has no `React.Activity`, so the suppression stays on while the panel remains open.

## Fragile points

- Abort checks re-read `open` with `untrack` inside completions; a stale completion would unmount a reopened panel or reset a close to `height: 0`.
- Any change that makes `ending` land before the panel measured breaks close transitions from `auto`.
- Tests for these paths: `utils/useTransitionStatus.test.tsx`, `internals/useAnimationsFinished.test.tsx`, `collapsible/panel/CollapsiblePanel.test.tsx` (browser cases need Chromium).
