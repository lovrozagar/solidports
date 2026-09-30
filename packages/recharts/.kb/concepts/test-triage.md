# Concept: test failure triage

## What this is

The bucket taxonomy and hand-off protocol for Phase 3 test-fix sessions.
Source of truth for what each bucket means, how to fix it, and when to escalate.

## Bucket taxonomy

Buckets are applied in order — first match wins. Classifier lives in `scripts/triage-tests.ts`.

### (a) reactive-drift

**Shape:** store read returns stale/initial value; assertion sees pre-update state.
**Root cause:** `useAppSelector` runs the selector once synchronously and returns the value,
not a reactive accessor. Tests that mutate via re-render or event see the snapshot, not
the live store.
**Fix pattern:** wrap `useAppSelector` call sites in `createMemo`. For simple property
reads, use `ctx.store.<path>` directly inside JSX or effects — already reactive.
**Files to grep:** `grep -rl "useAppSelector" src` (47 files at Phase 3 start).
**GOTCHA ref:** GOTCHA-002 (to be registered when fix is applied).

### (b) store-semantics

**Shape:** `setStore is not a function`, `action is not a thunk`, `useAppDispatch` not defined.
**Root cause:** Redux-style dispatch shim (`hooks.ts`) doesn't map cleanly to Solid store.
`StoreAction` thunk pattern `(setStore, store) => void` is called like `dispatch(action(...))`.
**Fix pattern:** collapse thunks into `createActions(store, setStore)` factory per
`.kb/concepts/store-design.md`. This overlaps Phase 4 — if bucket count is top-2, pull
Phase 4 work forward.

### (c) test-helper

**Shape:** `rerender is not a function`, `act is not defined`, `unmount is not a function`.
**Root cause:** tests were written against React Testing Library API. Solid's
`@solidjs/testing-library` has different surface — no `rerender`, no `act`.
**Fix pattern:** replace `rerender(<X prop={v} />)` with signal-based update.
Write `test/helper/renderWithSignals.tsx` that returns `{ container, update(newProps) }`.
Reusable across ~50 test files.

### (d) animation

**Shape:** assertion on mid-tween DOM value fails; `react-smooth` not found;
`requestAnimationFrame` callback never fires.
**Root cause:** `react-smooth` replaced by custom Solid animation manager. jsdom
doesn't run rAF-driven animations.
**Fix pattern:** (i) mock rAF deterministically in `test/helper/mockRAF.ts`;
(ii) for end-state-only tests, `await new Promise(r => setTimeout(r, 300))`.

### (e) measurement

**Shape:** `getBoundingClientRect` returns zeros; `ResizeObserver` never fires;
layout-dependent assertion fails.
**Root cause:** jsdom layout is a stub. All geometry reads return 0.
**Fix pattern:** call `mockGetBoundingClientRect` helper at test top. Audit which
test files touch layout but don't call the helper.

### (f) test-fixture

**Shape:** `toEqual` / `toMatchSnapshot` mismatch; `cannot find module`; mock returns
wrong shape.
**Root cause:** data shape drift between upstream React tests and port, or stale imports.
**Fix pattern:** per-file. Align mock data to actual component prop types.

### (g) timeout

**Shape:** worker terminated; test file times out entire vitest pool.
**Root cause:** likely a synchronous infinite loop in a `createEffect` — effect fires
setter that invalidates the effect.
**Investigation:** `bunx vitest run <file> --pool=forks --poolOptions.forks.singleFork=true`
to isolate without killing other workers.
**Known instance:** `Tooltip.visibility.spec.tsx` — excluded from triage runs.

### (h) unclassified

Everything the classifier didn't match. Cap at 20 files before refining classifier.
Each unclassified file goes to `debugger` agent with the raw error.

## Hand-off protocol for session 2+

1. Read `cat .triage/bucket-<name>.txt | head -20` — highest-failure files first.
2. Pick top file. Run `bunx vitest run <pattern>` in isolation.
3. Match error shape to bucket playbook above.
4. Fix source or test (source first).
5. Re-run triage after bucket complete: `bun run triage`.
6. Confirm count dropped. Diff new report vs previous.
7. Register GOTCHA in `.kb/solid/gotchas.md` if new sharp edge found.
8. Move to next bucket or next file in same bucket.

## ROI order (architect-prescribed, may reorder after actual counts)

1. reactive-drift — suspected largest, one shared fix (createMemo wrapping) fixes many.
2. test-helper — ~50 files, one shared helper (`renderWithSignals`) fixes most.
3. store-semantics — overlaps Phase 4; pull forward if top-2 by count.
4. api-shape — per-file but usually small diffs.
5. animation — rAF mock + timeout pattern, finite file set.
6. measurement — mockGetBoundingClientRect audit, finite file set.
7. test-fixture — per-file, last resort.
8. timeout — debugger agent, isolated investigation.
9. unclassified — debugger agent, per-file.

## Re-running triage

`bun run triage` always writes new timestamped files. Compare reports:

    diff .triage/report-<old>.md .triage/report-<new>.md

or use the JSON for programmatic diffing across sessions.
