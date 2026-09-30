# Workflow: porting a new component (React → Solid)

## When to use

The user asks you to port a recharts component that is incomplete or failing tests.

## Inputs you need

- Component name (e.g. `CartesianAxis`, `Tooltip`).
- Upstream file path: `src/<dir>/<Name>.tsx`.
- Current test fail count for this component (run `bunx vitest run <Name>` first).

## Steps

1. **Read upstream source.** `https://github.com/recharts/recharts/blob/v3.8.1/src/<path>`
   Skim for hooks, context reads, React.Children usage, forwardRef, cloneElement.

2. **Check layer.** `../concepts/dependency-graph.md` — confirm all deps are ported.

3. **Read porting context:**
   - `../porting/playbook.md` — translation table.
   - `../solid/reactivity-rules.md` — Solid-specific rules.
   - `../solid/store-semantics.md` — store access pattern.

4. **Translate** following playbook step 4 translation table.
   Key decisions for recharts:
   - `useAppSelector(selectX)` → `store.x` (direct) or `createMemo(() => combineX(store))`.
   - `useAppDispatch()` + `dispatch(action(payload))` → `actions.actionName(payload)`.
   - `React.Children.map` + `cloneElement` → render prop or explicit `children()` + typed accessor.
   - `forwardRef` → `ref` as plain prop, typed `ref?: (el: El) => void`.

5. **className boundary.** Public prop = `className`. Native element = `class={props.className}`.

6. **Run test baseline before touching source:**
   ```bash
   cd public/solid-ports/recharts && bunx vitest run <Name> 2>&1 | tail -20
   ```

7. **Implement.** One concern at a time. Lint after each function.

8. **Run tests + lint + typecheck:**
   ```bash
   cd public/solid-ports/recharts && bunx vitest run <Name>
   bunx oxlint public/solid-ports/recharts/src/<path>
   bunx tsc --noEmit 2>&1 | grep "public/solid-ports/recharts/src/<path>"
   ```

9. **Update KB** if new cross-cutting gotcha found → `../solid/gotchas.md` next `GOTCHA-NNN`.

## Done when

- [ ] `bunx tsc --noEmit` clean for this file.
- [ ] Test fail count equal or lower than baseline.
- [ ] `bunx oxlint` clean for this file.
- [ ] No React imports in the ported file.
