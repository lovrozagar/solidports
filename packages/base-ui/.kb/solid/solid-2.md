# Solid 2 — porting rules

> Layer: **solid** (the port). Applies to Solid 2.0 RC (`solid-js` 2.x, `@solidjs/web`).
> Last reviewed: 2026-10-02

Solid 2 batches every write until the next flush, runs effects in two phases (a tracked
compute and an untracked apply), and reports misuse as dev diagnostics. The suite turns those
diagnostics into failures (`vitest-fail-on-console`), so they are part of correctness.

## Effects

- React `useEffect(fn, deps)` / `useIsoLayoutEffect` → `createEffect(() => ({ ...deps }), (deps) => { ...; return cleanup })`.
  The compute reads the dependencies; the apply does the work with the values it receives and
  **returns** its cleanup. Never call `onCleanup` inside an effect or `onSettled`.
- `on(deps, fn)` (in `solid-1-compat`) is the same shape with an untracked apply: React's
  `useEffect(fn, deps)` one to one.
- React `[]` deps → `onSettled(() => { ...; return cleanup })` (runs once mounted).
- Layout-effect timing that must precede descendant effects → `createRenderEffect`.
- Do not use `createTrackedEffect`: it reads stale values and tears.
- Never write back into a store a value the effect's compute read from that store: the compute
  saw the committed value, so the apply can clobber a newer write made in the same flush.
- No reactive primitives (signals, memos, effects, `merge` views, interaction getters) inside
  effects, `onSettled`, memos or getters (`PRIMITIVE_IN_FORBIDDEN_SCOPE`).
- `flush()` may not run inside `onSettled`; defer with `queueMicrotask`.

## Reads

- A component body, a handler, a ref callback and an effect apply are untracked. Reading a
  signal there is fine when it is intentional, but say so with `untrack(...)` (otherwise
  `STRICT_READ_UNTRACKED`).
- Initial values read once (React `useState(initial)`, `useRef(initial)`) → `untrack(...)`.
- `live(fn)` (solid-helpers): an accessor that tracks inside computations and reads untracked
  elsewhere. Use it for store/context accessors read imperatively by handlers and effects.
- A memo is React's render-time value; a raw accessor read in a handler is React's latest
  (stable-callback) value. Pick deliberately (e.g. NavigationMenuTrigger `isActiveItem` is a memo
  because `useClick` reads it as a render-time `toggle`).

## Writes

- Writes inside a component body or computation throw `REACTIVE_WRITE_IN_OWNED_SCOPE`.
  Cleanups count when Solid disposes a subtree from inside a parent computation.
- Registration signals cleared from unmount cleanups: `createSignal(v, { ownedWrite: true })`.
- Other legitimate external writes (store setters, list registries): run them ownerless,
  `runWithOwner(null, () => untrack(() => write()))`.
- `flushSync(fn)` (utils/flushSync) = `ReactDOM.flushSync`.

## Base UI store (`createStoreState`, `SolidStoreV2`)

Same semantics as React's `Store`:

- shallow (`{ shallow: true }`): values held by reference, never deep-wrapped;
- synchronous: untracked reads see the latest written value, tracked reads see the committed
  value (consistent within a flush);
- external: `set` is valid anywhere, including unmount cleanups;
- `set(key, fn)` stores the function; `observe` is synchronous.

`useControlled` follows the same rule for the uncontrolled value.

## Refs

- Solid applies refs once, ownerless, and never calls them with `null`. `useRenderElement` calls
  the part's internal refs (`params.ref`) with `null` on unmount, as React does; user refs keep
  Solid's contract. Raw-JSX refs that need unmount handling need an explicit `onCleanup` in the
  owning scope.
- `createSignal(fn)` makes a derived signal: store a function value as `createSignal(() => fn)`.

## JSX and props

- ARIA booleans must be strings (`'true'`/`'false'`); a bare `true` renders as an empty attribute.
- A later `undefined` overrides an earlier prop in a spread or merge: omit keys instead of
  setting them to `undefined`.
- Props use DOM attribute names (`for`, `autocomplete`, `spellcheck`, `tabindex`).
- `style` objects are read in the apply phase: build reactive styles inline in JSX, not with
  getters.
- Context defaults are `null` (React uses `undefined`): compare with `!= null`.

## Tests

- `act()` (test/act.ts) applies queued writes. Testing-library events, the test clock and
  `flushMicrotasks` are already act-wrapped. Wrap bare signal setters, `el.click()`, `focus()` and
  `vi.advanceTimersByTime` in `act`.
- `SOLID_DIAG_FILE=<file> [SOLID_DIAG_FULL=1]` records every Solid dev diagnostic with its stack.
