# Workflow: fixing a failing test

## When to use

A test under `test/` is failing and you need to diagnose and fix it.

## Inputs you need

- Test file path or pattern.
- The error message / assertion failure output.
- Whether it was passing before and what changed.

## Steps

1. **Reproduce in isolation:**
   ```bash
   cd public/solid-ports/recharts && bunx vitest run <pattern> 2>&1 | tail -40
   ```

2. **Classify the failure:**

   Failure shape                               Likely cause
   Assertion fires before DOM update           React-style `act()` left in test — remove it
   Component renders nothing / null            Props destructured — fix to `props.foo`
   Store read returns stale value              Read inside non-tracking scope — wrap in createMemo
   Event handler not firing                    Using React event syntax — use Solid `on:event`
   Multiple state updates visible mid-handler  Missing `batch()` in event handler
   Ref is undefined                            Ref passed as prop but not wired with `ref={el => ...}`
   Test imports from `recharts-solid`          Old package name — update to `@solidports/recharts`

3. **Compare with upstream test.** Upstream test at same relative path in
   `https://github.com/recharts/recharts/blob/v3.8.1/test/<path>`.
   Surprising assertion differences usually point at the root cause.

4. **Fix source or test** following `../porting/playbook.md` translation rules.
   Fix source first if the component is wrong; fix test only if the test used React idioms.

5. **Re-run + verify no regression:**
   ```bash
   cd public/solid-ports/recharts && bunx vitest run <pattern>
   ```

6. **Lint + typecheck changed files:**
   ```bash
   bunx oxlint public/solid-ports/recharts/src/<file>
   bunx tsc --noEmit 2>&1 | grep "public/solid-ports/recharts"
   ```

7. **Register gotcha** if a new Solid sharp edge was discovered:
   append to `../solid/gotchas.md` as next `GOTCHA-NNN`.

## Done when

- [ ] Originally failing test passes.
- [ ] No other test count regressed.
- [ ] `bunx oxlint` and `bunx tsc --noEmit` clean for changed files.
- [ ] New sharp edge (if any) registered in `../solid/gotchas.md`.
