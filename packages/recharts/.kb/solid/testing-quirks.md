# Solid testing quirks — @solidports/recharts

Append-only registry. Solid tests run inside a vitest + `@solidjs/testing-library` + jsdom + fake-timers stack. React-style idioms break at several known points. Each entry names the delta and links to the fix.

---

## QUIRK-001: `rerender(<X prop={new}/>)` has no Solid equivalent

**Phase:** 3 (test-helper bucket)
**Helper:** `test/helper/renderWithSignals.tsx`

**Cause:** React's `render()` returns `{ rerender }` that re-mounts the tree with new props. Solid components run their factory exactly once — updates happen via signal mutation, not re-mount. Tests ported verbatim from React recharts call `rerender(<LineChart data={next}/>)` and get `TypeError: rerender is not a function`.

**Fix pattern:** use `renderWithSignals` — a wrapper around `@solidjs/testing-library`'s `render` that exposes `update(patch)` and `rerender(nextProps)` backed by a parent `createSignal<P>`.

```tsx
/* before — React rerender */
const { rerender } = render(<LineChart data={initial} />)
rerender(<LineChart data={next} />)

/* after — Solid signal-backed */
const { update } = renderWithSignals(
	(p: { data: Datum[] }) => <LineChart data={p.data} />,
	{ data: initial },
)
update({ data: next })
```

Use `update({ ... })` for merge-patch (recommended — other props preserved). Use `rerender({ ... })` only when the test wants full prop replacement (React parity).

Tests that re-mount to test unmount semantics (`rerender(<></>)`) should use `result.unmount()` directly instead.

---

## QUIRK-002: `vi.runOnlyPendingTimers()` / `vi.runAllTimers()` hang under vitest 4.1.3 + setup-file fake timers

**Phase:** 3 (test-helper bucket, root cause of STACK_TRACE_ERROR)
**Helper:** `test/helper/createSelectorTestCase.tsx` (fixed), `test/vitest.setup.ts`

**Cause:** `test/vitest.setup.ts` installs fake timers globally via `vi.useFakeTimers()`. Under vitest 4.1.3, calling `vi.runOnlyPendingTimers()`, `vi.runAllTimers()`, or `vi.advanceTimersToNextTimer()` inside a test body does NOT hang the test synchronously — the body returns — but vitest then fails to resolve the test promise and times out after `testTimeout` (5000ms default). The symptom is "Test timed out in 5000ms" on tests whose body clearly completed, dumped as `Error: STACK_TRACE_ERROR` in the JSON reporter.

This was the dominant failure mode of Phase 3 session 2 — 729 of 792 test-helper bucket entries. Fix collapsed that to ~0 in session 3.

**Fix pattern:** replace all three hanging APIs with `vi.advanceTimersByTime(N)`:

```ts
/* broken — hangs */
vi.runOnlyPendingTimers()
vi.runAllTimers()
vi.advanceTimersToNextTimer()

/* fine — flushes same-tick pending */
vi.advanceTimersByTime(0)

/* fine — flushes a window of scheduled timers */
vi.advanceTimersByTime(10_000)
```

`advanceTimersByTime(0)` is equivalent-for-our-uses to `runOnlyPendingTimers` because our codebase only schedules 0ms or short-interval timers in reactive effects. If a specific test genuinely needs to drain an arbitrarily long queue, advance by a large enough finite window (e.g. `advanceTimersByTime(10_000)`).

Do NOT call `vi.useFakeTimers()` a second time inside a test body to "reset" — it removes the setup-file fake timers and may cause downstream flakes. Leave the setup-file contract as the sole owner.

---

## QUIRK-003: `React.createRef<T>()` / `React.createSignal` do not exist

**Phase:** 3
**Files:** `test/component/ResponsiveContainer.spec.tsx`, `test/shape/Curve.spec.tsx`, `test/shape/Rectangle.animation.spec.tsx`, `test/cartesian/XAxis/XAxis.state.spec.tsx`, `test/state/selectors/selectStackGroups.spec.tsx`

**Cause:** Ports-in-flight retained `React.createRef` and `React.createSignal` calls that slipped through the codegen — `React` is never imported so the call throws `ReferenceError: React is not defined`.

**Fix pattern:**
- `React.createSignal(x)` → `createSignal(x)` from `solid-js`.
- `React.createRef<T>()` has no Solid equivalent — use a local `let capturedRef: T | undefined` and pass `ref={(el) => (capturedRef = el)}` to the component. Assert on `capturedRef` after `render`.
- `React.JSX.Element` → `JSX.Element` from `solid-js`.

---

## QUIRK-004: nested `it()` / `test()` throws "Calling the test function inside another test function"

**Phase:** 3
**Files:** many — utility specs with deep describe trees (`test/util/DataUtils.spec.ts`, `test/util/svgPropertiesAndEvents.spec.ts`, etc.)

**Cause:** Ports accidentally kept sibling `it()` blocks indented inside the body of an earlier `it()` (closing brace misplaced). React/jest silently accepted this; vitest 4.x rejects it during collection, marks the whole file failed.

**Fix pattern:** manually unwrap. Find the first `it()` in the file that contains another `it()` in its body; close the outer `it` at the `expect(...)` that's clearly the test's final assertion, and promote all subsequent `it` / `describe` blocks out to the enclosing `describe`.

Automation hint: grep for `^\s*}\s*\n\s*it\(` patterns with `it` at too-deep indentation relative to the nearest enclosing `describe`.

---

## QUIRK-005: `vi.fn().mockImplementation(cb => ...)` triggers vitest warning ("mock did not use 'function' or 'class'")

**Phase:** 3
**Files:** `test/chart/responsive.spec.tsx`

**Cause:** vitest 4.1.3 emits a console warning ("The vi.fn() mock did not use 'function' or 'class' in its implementation") when `.mockImplementation(() => {})` is passed an arrow fn whose shape doesn't look like a constructor. In our setup `consoleWarningToError` converts warnings to test failures.

**Fix pattern:** pass a named `function` (constructor-style) directly to `vi.fn(...)`:

```ts
/* before — warning */
vi.stubGlobal("ResizeObserver", vi.fn().mockImplementation((cb) => { ... }))

/* after — clean */
vi.stubGlobal(
	"ResizeObserver",
	vi.fn(function ResizeObserverCtor(cb: (entries: ResizeObserverEntry[]) => void) { ... }),
)
```

---

## Related

- `concepts/test-triage.md` — bucket taxonomy and ROI order for phase 3.
- `solid/gotchas.md` — GOTCHA-002 (useAppSelector reactive-drift) is the sibling bucket to test-helper; tests still failing after test-helper conversion often surface as reactive-drift.
