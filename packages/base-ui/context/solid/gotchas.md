---
tags: [solid, gotchas, registry]
sources: [packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/withCaptureListeners.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/useControlled.ts]
verified: 2026-10-16
---

# Solid gotchas

Append-only registry of Solid 2 sharp edges that bite this port, each with a stable `GOTCHA-NNN` id. Every live entry was re-checked against rc.15 and the current code on 2026-10-16.

Rules for editing: never renumber. Add new entries at the end. When an entry stops being true, move it to Retired with a one-line reason. Runtime paths are under `node_modules/` (see [primitive costs](primitive-costs.md) for the layout).

## GOTCHA-002: `autofocus` is ignored on inserted elements

- **Symptom:** an element rendered with `autofocus` is not focused. Browsers honor the attribute only during page load.
- **Fix:** parts get it free, because `useRenderElement`'s ref handler calls `autofocus(el)` (`src/solid-helpers.tsx:58`). In raw JSX, call `autofocus(el)` from a ref. No `@solid-primitives` package is involved.

## GOTCHA-003: boolean attribute values

- **Symptom:** `aria-expanded={true}` renders `aria-expanded=""`, and `{false}` removes the attribute (`setAttribute`, `web.js:572`).
- **Fix:** pass `'true'`/`'false'` strings for ARIA and other enumerated attributes.

## GOTCHA-004: components inside `createMemo`

- **Symptom:** `createMemo(() => <X />)` re-creates `X`, losing its state, on every recompute.
- **Fix:** render with direct JSX or control flow. Memoize data, not elements.

## GOTCHA-005: effect apply runs even when compute returns the same value

- **Cause:** effect nodes use `equals: false` (`core/core.js:714`), so the apply runs after every compute rerun. A probe showed 2 applies for 2 writes with identical results.
- **Fix:** compare against `prev` in the apply, or put the dependencies behind a memo with `equals`. `createDepsEffect` (`src/solid-helpers.tsx:103`) does the latter for React-style dependency lists.

## GOTCHA-006: a write is invisible until the flush

- **Symptom:** `setA(2); a()` returns the old value, tracked or untracked, until the microtask flush.
- **Fix:** use the value you wrote, or call `flush()` where allowed (not in `onSettled`, `createTrackedEffect` or effect callbacks). The Base UI store's untracked reads are the exception: they see the latest write.

## GOTCHA-007: `setContext` copies the whole context record

- **Cause:** each call spreads the owner's record into a new object (`core/context.js:55`). Every `<Provider>` adds a root and `children()` on top.
- **Fix:** provide a part's contexts on one owner (`provideNativeContexts`, `src/utils/native/context.ts`). Avoid a provider per list row.

## GOTCHA-008: `merge` with a function source allocates a memo

- **Cause:** `merge(() => obj, …)` wraps the function in `createMemo` (`store/utils.js:924`). That is an owned node and, on the server, a hydration id.
- **Fix:** pass objects (getters stay live). Use a function source only when the whole source object changes identity.

## GOTCHA-009: `on:`, `oncapture:` and lowercase `on*` become attributes

- **Symptom:** a handler never fires, and the element gets an attribute holding the function's source text. rc.15 compiles these to `setAttribute` in the grouped effect. rc.13 emitted dead `addEvent(el, ":keydown")` listeners.
- **Fix:** use `onX` (uppercase third letter). Attach capture listeners through `withCaptureListeners` (`src/utils/withCaptureListeners.ts`). Details in [refs and events](refs-and-events.md).

## GOTCHA-010: `onCleanup` inside effect callbacks

- **Symptom:** in an effect apply, `onCleanup` warns `NO_OWNER_CLEANUP` and never runs. In `onSettled` or `createTrackedEffect`, dev throws `CLEANUP_IN_FORBIDDEN_SCOPE`. Production stays silent.
- **Fix:** return the cleanup from the apply or from `onSettled`. `onCleanup` belongs in component bodies and computes.

## GOTCHA-011: two `mergeProps` with opposite `undefined` rules

- **Cause:** `mergeProps` from `@solidjs/web` is Solid 2 `merge`, which the compiler also emits for `<Part {...props} x />`. There, a later `undefined` overrides and keys stay live. The compat `mergeProps` (`src/solid-1-compat.ts:16`) skips `undefined` and fixes its key set at call time.
- **Fix:** check which import a file uses before reasoning about overrides. Omit keys rather than set them to `undefined` when the Solid 2 `merge` is in play.

## GOTCHA-012: compiled handlers are read once

- **Symptom:** `onClick={props.onClick}` keeps the first handler. The compiler calls `addEvent` once at setup, with no effect.
- **Fix:** forward a stable wrapper (`onClick={(e) => props.onClick?.(e)}`) or go through a spread, which re-assigns changed handlers.

## GOTCHA-013: delegated handlers need a registered root

- **Cause:** rc.15 attaches delegated listeners to each `render()`/`hydrate()` root and to Portal mounts outside it (`web.js:411`, `:2142`). The dispatcher also skips the handler of any node whose `disabled` is true (`:1694`).
- **Symptom:** handlers on elements outside every root never run. A disabled button's own delegated `onClick` is skipped while ancestors still see the event.
- **Fix:** mount through `render`, `hydrate` or `Portal`. Do not rely on a delegated handler firing on a disabled element.

## GOTCHA-014: server render effects run their apply

- **Cause:** `createRenderEffect` runs compute and apply once on the server (`server.js:1077`). `createEffect` runs compute only.
- **Fix:** ported layout effects use `createLayoutEffect` (`src/solid-helpers.tsx:121`). It keeps the node for id alignment and drops the server apply.

## GOTCHA-015: `undefined` context defaults throw

- **Cause:** `getContext` throws `ContextNotFoundError` when neither a value nor a default is defined (`core/context.js:35`).
- **Fix:** port contexts default to `null` (React's are `undefined`), so compare with `!= null`.

## GOTCHA-016: `createSignal(fn)` is a writable memo

- **Symptom:** storing a function value calls it. A written value is replaced when a dependency of the function changes (`signals.js:72`).
- **Fix:** store functions as `createSignal(() => fn)`. `useControlled` does this only for function values (`src/utils/useControlled.ts`).

## Retired

- **GOTCHA-001** (type duplication across `floating-ui-solid`): `floating-ui-solid` mirrors `floating-ui-react` file for file by design, including `utils/composite.ts`, so the duplication is not a defect.
