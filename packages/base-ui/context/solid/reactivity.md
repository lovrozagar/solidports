---
tags: [solid, reactivity, effects, context, props]
sources: [packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/flushSync.ts, packages/base-ui/packages/solid/src/utils/useControlled.ts, packages/base-ui/packages/solid/test/act.ts, packages/base-ui/packages/solid/test/setupSolid.ts]
verified: 2026-10-17
---

# Solid 2 reactivity

Solid 2.0.0-rc.15 queues every write until a microtask flush and splits effects into a tracked compute and an untracked apply. Dev builds throw or warn on scope misuse, and the test setup fails on those warnings. This file describes the runtime behind the Solid reactivity rules in the root `AGENTS.md`.

Behavior below was probed on the installed rc.15 packages. Path layout is in [primitive costs](primitive-costs.md).

> The root `AGENTS.md` and `packages/base-ui/AGENTS.md` still name `createTrackedEffect` with `onCleanup`. On rc.15 `createTrackedEffect` is `@deprecated` and `onCleanup` inside it throws in dev. Use `createEffect(compute, apply)` and return the cleanup.

## Scheduling

- A write marks nodes dirty, and `schedule()` queues one `queueMicrotask(flush)` (`core/scheduler.js:351`). Until the flush, every read returns the old value, tracked or untracked.
- `flush()` drains synchronously (`core/scheduler.js:848`). `flush(fn)` runs `fn` and then drains.
- `flushSync` (`src/utils/flushSync.ts`) ports `ReactDOM.flushSync`. Tests flush through `act()` (`test/act.ts`) and after each testing-library event (`setupSolid.ts`).
- The Base UI store is different: untracked reads see the latest write. See [store and state](../architecture/store-and-state.md).

## Effect primitives

| Primitive | When it runs | Notes |
| --- | --- | --- |
| `createEffect(compute, apply)` | Compute in the pass. Apply queued after render effects, untracked, with no owner. | The apply returns its cleanup, which runs before the next apply and on disposal. The apply runs after every compute rerun, even when the value is unchanged, because effect nodes use `equals: false` (`core/core.js:714`). On the server only compute runs (`server.js:1112`). |
| `createRenderEffect(compute, apply)` | Render queue. The first run is synchronous on creation (`core/effect.js:25`). | The server runs compute and apply once (`server.js:1077`). The port's `createLayoutEffect` (`solid-helpers.tsx:121`) drops the server apply while keeping the node for id alignment. |
| `onSettled(fn)` | Once, after the current flush settles | Under an owner it is `trackedEffect(() => untrack(fn))` (`signals.js:634`). The returned function is the disposal cleanup. Each call takes one hydration id on both client and server (`server.js:1913`). |
| `createTrackedEffect(fn)` | Same flush, stale reads | `@deprecated` in rc.15 types. The port has no call sites. |

A `{ effect, error }` second argument routes compute-phase errors to `error`. An apply throw escalates to the nearest error boundary.

## Scope rules (dev)

| Scope | `onCleanup` | Create memo or effect | Write a signal |
| --- | --- | --- | --- |
| Memo or effect compute | runs on rerun or disposal | allowed (owned) | throws `REACTIVE_WRITE_IN_OWNED_SCOPE` |
| Component or root body | allowed | allowed | throws `REACTIVE_WRITE_IN_OWNED_SCOPE` |
| Effect apply | warns `NO_OWNER_CLEANUP`, never runs | throws `PRIMITIVE_IN_EFFECT_CALLBACK` | allowed |
| `onSettled`, `createTrackedEffect` | throws `CLEANUP_IN_FORBIDDEN_SCOPE` | throws `PRIMITIVE_IN_FORBIDDEN_SCOPE` | allowed |

- Production builds skip these checks. Tests run the dev build, and the shared setup fails a test on unexpected console output. For an inventory, run with `SOLID_DIAG_FILE=<file>` (add `SOLID_DIAG_FULL=1` for whole stacks; see `test/setupSolid.ts`).
- `flush()` inside `onSettled` or `createTrackedEffect` throws ("not reentrant"). Defer it with `queueMicrotask`.
- Legitimate external writes from owned scopes use `createSignal(v, { ownedWrite: true })` (74 sites) or `runWithOwner(null, () => untrack(write))` (19 sites).

## Derived values

- `createMemo` is eager and owned. It takes a hydration id unless created with `{ transparent: true }` (`inheritId`, `core/owner.js:166`).
- `createSignal(fn)` is a writable memo (`signals.js:72`): a write wins until a dependency changes, then it recomputes. Store a function value as `createSignal(() => fn)`. `useControlled` pays for that node only when the value is a function.
- `live(read)` (`solid-helpers.tsx:140`) tracks inside computations and reads untracked elsewhere: the React "latest value" read.
- `createDepsEffect` and `createDepsMemo` (`solid-helpers.tsx:103`, `:111`) emulate React dependency arrays with a `shallowEqual` memo. That adds one memo per site on top of the effect (71 effect sites).

## Props

- Props are getter objects, so keep reads lazy as the root rules require. The port wraps each prop in a thunk (`const modal = () => props.modal ?? false`, `popover/root/PopoverRoot.tsx:29`) and passes getters into store init.
- `merge` (re-exported by `@solidjs/web` as `mergeProps`, which the compiler emits for `<Part {...props} x />`) behaves like this:
  - It returns a view Proxy, and a later `undefined` overrides earlier values.
  - A single non-function source comes back as is (`store/utils.js:906-958`).
  - A function source allocates a memo (`:924`).
  - Reads walk the sources until 16 reads build a lookup table (`:532`).
  - Writes are no-ops.
- `omit` returns a view too, and nested omits fold into one record (`store/utils.js:1009`).
- The compat `mergeProps` and `splitProps` (`solid-1-compat.ts:16`, `:84`) keep Solid 1 semantics: keys are fixed at call time and `undefined` is skipped. See [GOTCHA-011](gotchas.md#gotcha-011-two-mergeprops-with-opposite-undefined-rules).
- `isStatic(props, key)` and `hasStaticKeys` (`store/utils.js:222`, `:194`) are one-descriptor checks for decisions made once at setup.
- Hook parameters are `MaybeAccessor<T>`, unwrapped with `access()` (`solid-helpers.tsx:51`, `:144`). `access` calls only zero-arity functions, so a callback value passes through.
- `children(fn)` costs two lazy memos (`solid.js:21`).

## Context

- `createContext(default)` returns a provider function. A provider is `createRoot` + `setContext` + `children()` (`solid.js:6`).
- `getContext` throws `ContextNotFoundError` when both the provided value and the default are `undefined` (`core/context.js:35`). Port contexts default to `null`, so compare with `!= null`.
- `setContext` copies the owner's whole context record on each call (`core/context.js:55`).
- `provideContext` (`solid-helpers.tsx`) provides a context to what `render` creates: on the client after hydration under one transparent owner (`createContextOwner`), on the server and while hydrating through the provider (111 sites). Native parts use `provideNativeContext` (`utils/native/context.ts`), the same on the client. Costs are in [primitive costs](primitive-costs.md).

## Disposal order

Disposal runs bottom-up: grandchild cleanups, then the child's effect cleanups, then the child, then the parent (probed). React unmounts top-down. When a ported cleanup reaches into a parent's ref or context, check that the parent state still exists, or move the cleanup to the parent.

## Related

- [Refs and events](refs-and-events.md), [gotchas](gotchas.md), [React idiom map](../react/idiom-map.md), [SSR and hydration](../architecture/ssr-hydration.md).
