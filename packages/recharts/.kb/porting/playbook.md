# Porting playbook — @solidports/recharts

Generic step order for porting any recharts component to Solid.

## Step order

1. **Identify the React surface.** Read the upstream file at
   `https://github.com/recharts/recharts/blob/v3.8.1/src/<path>`.
   List every hook, context, and util it imports.

2. **Check port layer.** Consult `../concepts/dependency-graph.md` to identify
   which layer the component lives in (Layers 0–10). Ensure all lower-layer
   deps are already ported before starting.

3. **Locate or stub Solid topic files.** For each cross-cutting concern
   (store, animation, context, events), confirm a `solid/<topic>.md` exists.
   Create a stub if missing.

4. **Translate hooks → primitives.**
   - `useState` → `createSignal`
   - `useEffect` → `createEffect` + `onCleanup`
   - `useLayoutEffect` → `createEffect` (Solid effects run synchronously after DOM)
   - `useRef` → `let ref: El | undefined` + `ref={el => (ref = el)}`
   - `useCallback` → plain function (Solid doesn't re-render, no memoization needed)
   - `useMemo` → `createMemo`
   - `useContext` → `useContext`
   - `React.forwardRef` → accept `ref` as regular prop
   - `React.Children.map` / `cloneElement` → render prop or `children()` accessor
   - `useSelector` / `useDispatch` → `useChartStore()` → `store.*` / `actions.*`

5. **Apply reactivity rules.** See `../solid/reactivity-rules.md`.
   Key: never destructure props, batch multi-setter handlers, createMemo for derived math.

6. **className boundary.** Public prop stays `className`. At native SVG/HTML element:
   `<path class={props.className} />`. Never rename the prop.

7. **Port the tests.** Drop `act()` and `flushMicrotasks`. Solid is synchronous.
   Keep `test/` structure mirroring `src/` — same filenames as upstream.

8. **Run tests and lint:**
   ```bash
   cd public/solid-ports/recharts && bunx vitest run <Pattern>
   bunx oxlint src/<file>
   bunx tsc --noEmit 2>&1 | grep "public/solid-ports/recharts"
   ```

9. **Update KB.** Append any new cross-cutting gotchas to `../solid/gotchas.md`
   (next `GOTCHA-NNN`). Note component status in `../components/<name>.md` if file exists.

## Done when

- [ ] File type-checks clean (no `error TS` for this file).
- [ ] Targeted test pattern passes or fail count does not increase.
- [ ] `bunx oxlint` clean for the file.
- [ ] No React imports remaining in the ported file.
- [ ] If new sharp edge found, registered in `../solid/gotchas.md`.
