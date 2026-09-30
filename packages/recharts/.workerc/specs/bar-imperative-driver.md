---
title: Bar imperative single-driver — beat React perf
session: 20260426-bar-imperative-driver
status: spec
target: solid Bar animation ≤ 0.003 ms/raf (currently 0.15 ms/raf, 50x React)
---

## Goal

Replace per-bar `createEffect` model in `Bar.tsx` (FastBarPath) with **one imperative driver** owning all N paths. One reactive read per animation tick, one tight imperative for-loop writing all paths' attributes. Pays Solid scheduler tax once per frame instead of N times.

Public API unchanged: `<Bar fill="..." dataKey="..." onClick={...} activeBar shape={...} />`.

## Why this beats React

- React batches all 28 component renders into 1 commit per frame. Solid schedules each `createEffect` independently — N effects per frame → N scheduler dispatches + N runTop/cleanNode round-trips.
- Solid's strength is fine-grained reactivity, but here all 28 paths share one upstream signal (`stepData`). Splitting fan-out across 28 effects is anti-pattern: Solid runs each one in turn against the same upstream value.
- One driver with one effect:
  - 1 dependency read on `stepData()`, then a plain JS loop.
  - No runTop, no cleanNode, no reactive owner walk per bar.
  - DOM updates via `el.setAttribute` direct — same as raw raf hand-tuned code.
- Net: 28 → 1 reactive update per frame. ~28x less scheduler overhead. JS-side loop cost is ~50ns × 28 = 1.4 µs total — orders of magnitude under React's commit cost.

## Decisions

### A. ONE driver component owns all default-shape paths

`BarImperativeDriver` is a NEW component replacing the `<Index>{ FastBarPath }>` block inside `BarRectangles` for the default-shape branch. It:

1. Allocates a stable `<g class="recharts-layer recharts-bar-stack-layer recharts-bar-rectangle">` per data row at setup, pre-allocating `els: SVGPathElement[]` in same order as `props.data`.
2. Mounts each `<g>` ONCE — JSX renders the wrapper structure (`<g class="recharts-bar-rectangle"><g class="recharts-inactive-bar"><path/></g></g>`) using a single `For` keyed by index. Wrappers never re-mount across animation ticks.
3. ONE `createEffect` reads `stepData()` and writes ALL paths' x/y/width/height/d/fill in a `for` loop.
4. Active-bar swap, cell-fill override, event delegation all read from same effect or static data (see below).

### B. Custom `shape` prop falls back to legacy chain

When `props.allProps.shape != null`, driver is bypassed. Legacy `BarStackClipLayer + BarRectangle + Shape` chain still rendered (current `useFastPath ? <FastBarPath/> : <BarStackClipLayer/>` branch keeps its else-arm). Custom shapes are uncommon and animation perf isn't the dominant concern there — they recompute their own JSX per frame anyway.

`activeBar` set to a custom shape OR object: same fallback. Driver only handles default rectangle shape.

### C. DOM structure (verbatim contract — `expectBars` / `expectActiveBars` depend on this)

```
<Layer class="recharts-bar-rectangles">                       ← existing
  <Layer>                                                      ← existing  RectanglesWithAnimation wrapper
    <For each={data} key=index>                                ← driver loop
      <g class="recharts-layer recharts-bar-stack-layer recharts-bar-rectangle"
         clip-path={clipPathUrl(i)}>
        <g class="recharts-layer recharts-inactive-bar"        ← wrapper class IS reactive: flips to "recharts-active-bar" when active
           classList={{ 'recharts-inactive-bar': !active(i), 'recharts-active-bar': active(i) }}>
          <path class="recharts-rectangle" />                  ← driver writes attrs imperatively
        </g>
      </g>
    </For>
  </Layer>
</Layer>
```

The classList toggle is the ONLY reactive JSX binding on the wrapper — it runs at most twice per active-state flip, not per frame. Path attribute writes happen entirely outside Solid's reactive graph (raw `setAttribute` from inside one effect).

### D. Active-bar handling

Current code has `isActive: false` hardcoded everywhere — active-bar is broken. Tests for active-bar are mostly `it.skip(...)`. Two-step plan:

1. **Driver default behavior**: read `selectActiveTooltipIndex` + `selectActiveTooltipDataKey` reactively. Compute `activeIdx() = matching index for this Bar's dataKey`. Toggle wrapper classList. The path's geometry stays the same — recharts default activeBar=true just adds the class for CSS hooks, no shape change.
2. **`activeBar={object}` / `activeBar={fn}` / `activeBar={JSX}`** → fallback to legacy `BarRectangleWithActiveState` chain (mirror upstream's `BarRectangles` branching: `activeBar ? WithActiveState : NeverActive`). Reason: object/fn/JSX semantically swap the option/shape entirely, including ZIndexLayer hoist — single driver can't represent that.
3. **`activeBar={true}` (boolean)** → driver path. Just toggle class via classList, no separate ZIndexLayer needed (default geometry doesn't change).

### E. Cell-fill override

`computeBarRectangles` already spreads `cells[i].props` into each `BarRectangleItem` (line 1091 of current Bar.tsx). The merged entry has `fill` set to the Cell's value. Driver reads `entry.fill` per row and writes `setAttribute("fill", entry.fill)`. No separate registry read in the driver — selector merges Cell props upstream.

`stepData` propagates `entry.fill` unchanged through `interpolate` (only x/y/width/height interpolated; fill is a string). No change to fill flow.

### F. Event delegation

Per-bar event handlers (onClick / onMouseEnter / onMouseLeave / onMouseOver / onMouseOut + user-supplied via `adaptEventsOfChild`) bind to the parent `<Layer class="recharts-bar-rectangles">`. Driver attaches ONE listener per event type. Handler:

```ts
function delegate(e: MouseEvent) {
  /* walk up from e.target until parent <g.recharts-bar-rectangle> */
  let n: Element | null = e.target as Element
  while (n && n !== rootEl && !n.classList.contains('recharts-bar-rectangle')) n = n.parentElement
  if (!n || n === rootEl) return
  const i = wrapperIndexMap.get(n)  /* WeakMap<gEl, index> built at setup */
  if (i == null) return
  const entry = stepDataValue[i]
  invokeHandler(entry, i, e)
}
```

`stepDataValue` = a plain `let` updated by the same driver effect (alongside attr writes). Handlers read it directly — no Solid subscription needed since the driver effect already runs per frame and writes the latest snapshot.

For mouseenter/mouseleave (which don't bubble), use `mouseover`/`mouseout` + dedupe (current Bar already does this for the per-bar handlers via `entered` flag — port the same logic to delegation).

This is a substantial perf win on its own: 28 bars × 5 listener types = 140 listener attachments → 5 listener attachments. Mounting cost cut, GC pressure cut.

### G. Background bars (`<BarBackground>`)

Out of scope. `BarBackground` is rarely used (only when `background` prop set), animations don't run on it (it's a static rectangle), and current `<For>` model is fine. Keep as-is.

### H. Stack clip-path

Each bar's `<g.recharts-bar-rectangle>` needs `clip-path={url(#...)} ` per index when inside `<BarStack>`. Driver reads `useBarStackClipPathUrl(i)` once per row at setup (it returns a stable string, not a signal — the stackId is from BarStack context). Write `setAttribute("clip-path", url)` once at mount.

### I. Validity gate (NaN protection)

Current code skips `<path>` render via `<Show when={isValid()}>` for invalid bars. Driver implements equivalent: when `entry.x !== +entry.x || entry.width === 0 || ...` (per same predicate), set path's `d=""` and `display="none"`. Or: don't write attrs at all that frame, leave previous state (less correct — could leak NaN). Decision: write `display="none"` for invalid frames; clear it when valid again. Cheaper than tear-down/remount.

## Rejected

### Rejected: keep `<Index>` + per-bar `createEffect` (status quo, micro-optimize)

Tried already. 28 effects per frame is structural — can't optimize past the scheduler dispatch overhead. Nothing here is wasted work; the work is just split too finely. Solid scheduler is not free — every effect run goes through `runTop` + dirty-set drain.

### Rejected: `createMemo<SVGPathElement[]>` returning attribute strings

Memo per-attribute would still fan out to per-attribute reactive readers. Doesn't reduce scheduler load.

### Rejected: `requestAnimationFrame` outside Solid's reactive system

Driver effect is already raf-paced (driven by `JavascriptAnimate`'s configUpdate which is raf-driven). Adding our own raf would race the animation manager. Read `t()` synchronously inside the effect; the effect itself fires on raf tick by construction.

### Rejected: virtual-DOM-style diff inside the driver

Per-attr `prevX !== x` checks already exist in FastBarPath. Keep them in the driver loop. Skip diffing of fill/d when geometry didn't change — same string comparisons.

### Rejected: SVG `<use>` element pooling

Doesn't help — each bar has unique geometry. `<use href="#bar-template">` would still need per-instance transform/scale, same DOM mutation count.

### Rejected: CSS transform animation (no JS-driven RAF)

Recharts contract is JS-driven interpolation through `JavascriptAnimate`. Tests assert `d` attribute changes per frame (test/cartesian/Bar.animation.spec.tsx line 71-74). Can't switch to CSS-only.

### Rejected: keep FastBarPath, remove `prev*` cache

Cache saves DOM writes when only some attrs changed — typical case for bar updates (only height + y change). Removing it would cost more `setAttribute` calls than the cache lookup saves.

## Implementation Plan

### Step 1: Add `BarImperativeDriver` component — `src/cartesian/Bar.tsx`

Insert NEW component between `FastBarPath` (line 399) and `BarRectangles` (line 467). Replace the `<Index>` + `<FastBarPath/>` branch in `BarRectangles` (lines 558-624) with `<BarImperativeDriver/>` when `useFastPath` is true. KEEP the `<Index>` + `<BarStackClipLayer>` else-arm for custom shape.

```tsx
function BarImperativeDriver(props: {
  data: () => ReadonlyArray<BarRectangleItem> | undefined
  staticPathAttrs: Record<string, unknown>
  pathClass: () => string
  radius: RectRadius | undefined
  baseClassName: string | undefined
  /* event handlers from useMouseEnter/Leave/Click + user-supplied */
  eventHandlers: Record<string, (data: BarRectangleItem, i: number, e: Event) => void>
  onMouseEnterFromContext: (entry: BarRectangleItem, i: number) => (e: MouseEvent) => void
  onMouseLeaveFromContext: (entry: BarRectangleItem, i: number) => (e: MouseEvent) => void
  onClickFromContext: (entry: BarRectangleItem, i: number) => (e: MouseEvent) => void
  /* active-bar */
  activeBar: ActiveShape<BarShapeProps, SVGPathElement> | false
  dataKey: DataKey<unknown> | undefined
}) {
  const ctx = useChartStore()
  /* reactive active index — only fires when tooltip activeIndex/dataKey changes */
  const activeIdx = createMemo(() => {
    if (!ctx || !props.activeBar) return -1
    const i = selectActiveTooltipIndex(ctx.store)
    const dk = selectActiveTooltipDataKey(ctx.store)
    if (i == null) return -1
    if (dk != null && dk !== props.dataKey) return -1
    return Number(i)
  })

  /* parallel arrays — `els` populated by ref callbacks during initial For render.
     Same length as data; index i is bar i. */
  const els: (SVGPathElement | null)[] = []
  const wrappers: (SVGGElement | null)[] = []
  const innerWrappers: (SVGGElement | null)[] = []

  /* per-bar prev caches keyed by index so partial-update skip works the same as FastBarPath */
  const prev: Array<{ x: number; y: number; w: number; h: number; d: string; fill: string }> = []

  /* mutable snapshot of current step data, read by event delegation.
     Updated inside the driver effect alongside attr writes. */
  let currentData: ReadonlyArray<BarRectangleItem> | undefined

  /* ONE effect drives all paths */
  createEffect(() => {
    const data = props.data()
    currentData = data
    if (data == null) return
    const radius = props.radius ?? 0
    for (let i = 0; i < data.length; i++) {
      const e = data[i]
      const el = els[i]
      if (el == null) continue
      const valid =
        e.x === +e.x && e.y === +e.y && e.width === +e.width && e.height === +e.height &&
        e.width !== 0 && e.height !== 0
      if (!valid) {
        if (el.getAttribute('display') !== 'none') el.setAttribute('display', 'none')
        continue
      }
      let p = prev[i]
      if (p == null) { p = { x: NaN, y: NaN, w: NaN, h: NaN, d: '', fill: '' }; prev[i] = p }
      const x = round(e.x), y = round(e.y), w = round(e.width), h = round(e.height)
      if (x !== p.x) { el.setAttribute('x', String(x)); p.x = x }
      if (y !== p.y) { el.setAttribute('y', String(y)); p.y = y }
      if (w !== p.w) { el.setAttribute('width', String(w)); p.w = w }
      if (h !== p.h) { el.setAttribute('height', String(h)); p.h = h }
      const d = getRectanglePath(e.x, e.y, e.width, e.height, radius)
      if (d !== p.d) { el.setAttribute('d', d); p.d = d }
      const f = e.fill
      if (f != null && f !== p.fill) { el.setAttribute('fill', f as string); p.fill = f as string }
      if (el.getAttribute('display') === 'none') el.removeAttribute('display')
    }
  })

  /* SECOND effect: active class toggle. Cheap — only fires when activeIdx() flips. */
  createEffect((prevIdx: number) => {
    const idx = activeIdx()
    if (prevIdx >= 0 && innerWrappers[prevIdx]) {
      const w = innerWrappers[prevIdx]!
      w.classList.remove('recharts-active-bar')
      w.classList.add('recharts-inactive-bar')
    }
    if (idx >= 0 && innerWrappers[idx]) {
      const w = innerWrappers[idx]!
      w.classList.remove('recharts-inactive-bar')
      w.classList.add('recharts-active-bar')
    }
    return idx
  }, -1)

  /* event delegation — bind once, dispatch by walking up to .recharts-bar-rectangle */
  let rootEl: SVGGElement | undefined
  const findIndex = (target: EventTarget | null): number => {
    let n = target as Element | null
    while (n && n !== rootEl) {
      const idx = wrappers.indexOf(n as SVGGElement)
      if (idx >= 0) return idx
      n = n.parentElement
    }
    return -1
  }

  let entered = -1
  const onOver = (e: MouseEvent) => {
    const i = findIndex(e.target)
    if (i < 0 || !currentData) return
    const entry = currentData[i]
    if (entered === i) return
    entered = i
    props.eventHandlers.onMouseOver?.(entry, i, e)
    props.eventHandlers.onMouseEnter?.(entry, i, e)
    props.onMouseEnterFromContext(entry, i)(e as MouseEvent & { currentTarget: SVGElement })
  }
  const onOut = (e: MouseEvent) => {
    const i = findIndex(e.target)
    if (i < 0 || !currentData) return
    const entry = currentData[i]
    if (entered !== i) return
    entered = -1
    props.eventHandlers.onMouseOut?.(entry, i, e)
    props.eventHandlers.onMouseLeave?.(entry, i, e)
    props.onMouseLeaveFromContext(entry, i)(e as MouseEvent & { currentTarget: SVGElement })
  }
  const onClickDel = (e: MouseEvent) => {
    const i = findIndex(e.target)
    if (i < 0 || !currentData) return
    const entry = currentData[i]
    props.eventHandlers.onClick?.(entry, i, e)
    props.onClickFromContext(entry, i)(e as MouseEvent & { currentTarget: SVGElement })
  }

  return (
    <g
      ref={(el) => (rootEl = el)}
      onMouseOver={onOver}
      onMouseOut={onOut}
      onClick={onClickDel}
    >
      <For each={props.data() as ReadonlyArray<BarRectangleItem>}>
        {(entry, i) => {
          const idx = i()
          const clipUrl = useBarStackClipPathUrl(idx)
          /* untracked snapshot for static svg attrs (name, payload, etc.) */
          const initialEntry = untrack(() => entry)
          const entryStatic: Record<string, unknown> = { ...(initialEntry as unknown as Record<string, unknown>) }
          /* drop reactive geometry + computed fields — same delete list as FastBarPath */
          for (const k of ['x','y','width','height','fill','radius','value','background','tooltipPosition','parentViewBox','payload','stackedBarStart']) {
            delete entryStatic[k]
          }
          return (
            <g
              ref={(el) => (wrappers[idx] = el)}
              class="recharts-layer recharts-bar-stack-layer recharts-bar-rectangle"
              clip-path={clipUrl}
            >
              <g
                ref={(el) => (innerWrappers[idx] = el)}
                class="recharts-layer recharts-inactive-bar"
              >
                <path
                  ref={(el) => {
                    els[idx] = el
                    el.setAttribute('radius', String(props.radius ?? 0))
                  }}
                  {...props.staticPathAttrs}
                  {...entryStatic}
                  class={props.pathClass()}
                />
              </g>
            </g>
          )
        }}
      </For>
    </g>
  )
}
```

Edge cases handled:
- `data` empty/undefined: outer `<Show when={props.data}>` already gates. Driver returns `<g/>` empty.
- `data.length` changes mid-animation: `<For>` rebuilds rows, refs repopulate `els[]`. The `prev[]` array is sparse; entries beyond new length get garbage-collected next frame's loop.
- Radius is array: `getRectanglePath` already handles. Pass through unchanged.

### Step 2: Wire driver into `BarRectangles` — `src/cartesian/Bar.tsx`

Replace the entire `<Show when={props.data}><Index ...>...</Index></Show>` block (current lines 556-665). Keep the slow path (custom shape) intact:

```tsx
return (
  <Show when={props.data}>
    {useFastPath ? (
      <BarImperativeDriver
        data={() => props.data}
        staticPathAttrs={staticPathAttrs as Record<string, unknown>}
        pathClass={pathClass}
        radius={radius as RectRadius | undefined}
        baseClassName={baseClassName}
        eventHandlers={eventHandlers}
        onMouseEnterFromContext={onMouseEnterFromContext}
        onMouseLeaveFromContext={onMouseLeaveFromContext}
        onClickFromContext={onClickFromContext}
        activeBar={props.allProps.activeBar}
        dataKey={props.allProps.dataKey}
      />
    ) : (
      <Index each={props.data}>
        {(entry, index) => {
          /* ... unchanged slow-path body ... */
        }}
      </Index>
    )}
  </Show>
)
```

### Step 3: Activate fast path for `activeBar={true}` (boolean only) — `src/cartesian/Bar.tsx`

Update `useFastPath` (line 522):

```tsx
/* boolean true keeps fast path (driver toggles class only).
   object/fn/JSX shape OR object/fn/JSX activeBar → slow path: shape branch can rebuild option per row. */
const ab = props.allProps.activeBar
const activeBarIsBool = ab === false || ab === true
const useFastPath = props.allProps.shape == null && activeBarIsBool
```

### Step 4: Drop `FastBarPath` — `src/cartesian/Bar.tsx`

DELETE lines 387-465 (FastBarPath component). Driver subsumes it.

### Step 5: Remove unused imports — `src/cartesian/Bar.tsx`

Removed: `createSignal`, `mergeProps` (in this file's local use — verify), maybe `Index` if no longer used. Run `bunx oxlint src/cartesian/Bar.tsx` after to catch.

### Step 6: Verify no test regression — `test/cartesian/Bar/`

Run: `cd public/solid-ports/recharts && bunx vitest run test/cartesian/Bar`

Expected pass: 137/137.

Tests likely needing migration (if any):
- **`Bar.animation.spec.tsx`** — uses `MockProgressAnimationManager.setAnimationProgress(0.1..1)`. Driver runs ONE effect on `t()` change, writes attrs imperatively. The effect must fire synchronously after manager updates `style.t` for the test to read updated `getAttribute('d')`. Verify: `JavascriptAnimate` calls `setStyle(...)` which writes the signal → driver effect re-queues → flushes synchronously in Solid (no batching delay). Should pass without change.
- **`Bar.csstransition.spec.tsx`** — tests CSS transitions on active-bar. Currently `it.skip(...)`. After driver, classList toggle works → may un-skip if test exists. Check; un-skip iff tests now pass.
- **`Bar.spec.tsx` mouse interaction tests** — event delegation must produce identical dispatch. Test asserts `setActiveMouseOverItemIndex` called with `{ activeIndex: '0', activeDataKey: 'x', activeGraphicalItemId: id, ... }`. Driver's `onMouseEnterFromContext(entry, i)(e)` matches FastBarPath's call exactly. Should pass.

If tests fail: examine which DOM contract diverged. Most likely culprit: `entryStatic` keyset differs from FastBarPath's. Verify same `delete` list.

### Step 7: Visual regression — `examples/visual/`

Run: `cd public/solid-ports/recharts/examples/visual && bunx playwright test charts.spec.ts -g bar`

Driver path renders to identical DOM under React parity → visual diff < 5% threshold.

### Step 8: Perf measurement (manual, not in test gate)

User confirms via their existing benchmark harness: Solid ≤ 0.003 ms/raf.

If still > target: investigate `JavascriptAnimate`'s setStyle flush — `setStyle({ t: 0.5 })` triggers all subscribers; the driver effect is one subscriber, so cost should be ~one synchronous effect.run + the JS for-loop. Profile with Chrome devtools → look for any unexpected `runTop` calls during the animation.

## Acceptance gates

1. **Perf**: Solid Bar animation ≤ 0.003 ms/raf (matches/beats React).
2. **Tests**: 137/137 Bar tests green. If any are migrated/un-skipped: justify in commit message.
3. **TypeCheck**: `bunx tsc --noEmit 2>&1 | grep "public/solid-ports/recharts"` returns 0 errors.
4. **Lint**: `bunx oxlint src/cartesian/Bar.tsx` returns 0 errors.
5. **Visual parity**: visual harness diff < 5% pixel ratio vs React reference for bar chart.
6. **Manual smoke**: examples/basic + examples/shadcn render identically pre/post change. Active-bar hover toggles class. Cell-fill colored bars correct. Custom shape (BarChart with `<Bar shape={...}>`) still renders.

## Risk assessment

### High risk

- **Event delegation off-by-one or wrong target**: when path is hovered, `e.target` is `<path>`, parent is inner `<g.recharts-inactive-bar>`, parent is `<g.recharts-bar-rectangle>`. `findIndex` walks up correctly. But: if user passes a custom CSS that adds elements between, walk could miss. Mitigation: walk by classList match, not by parent depth.
- **`stepData` snapshot read by event delegation must be current**: driver effect updates `currentData` BEFORE returning. Solid runs effects synchronously on signal write — no microtask gap. But: if a click event fires DURING an effect run (impossible — events are async), `currentData` could be stale. Not a real concern.
- **`<Show when={props.data}>` outer gate**: driver does its own data check. Wrapping in Show means driver mounts/unmounts when data goes from non-null to null. Each remount: WeakMap reset, els[] reset, prev[] reset. Verify: data going `[]` (empty array) shouldn't unmount — `<Show when={data}>` truthy for empty arrays. OK.
- **Active-bar regression**: current tests for active-bar are `.skip`. Don't accidentally break the (not-tested) old behavior elsewhere. Confirm via manual hover on `examples/shadcn` BarActive example.

### Medium risk

- **Stack clip-path stale on data resize**: `useBarStackClipPathUrl(i)` reads BarStackContext + stack rects selector. If stack rects change shape (e.g. dataset swap shrinks), per-index URLs realign. Driver reads URL once per row at row mount inside `<For>`'s row callback; since `<For>` rebuilds rows on identity change of `data`, the URL refreshes naturally on dataset change. No action.
- **Initial mount paint**: first render writes attrs in driver effect, but `<For>` mounts paths with NO geometry attrs (only static ones). There's a 1-frame window where paths render at 0,0,0,0. Mitigation: in the path's `ref` callback, trigger an immediate `runEffect` for that row, OR write initial geometry before the ref returns. Simpler: in the ref callback, capture the entry via `untrack(() => entry)` and call same setAttribute logic synchronously. Add helper `applyAttrs(el, entry, radius, prev[idx])` shared between mount-ref and effect.
- **Validity gate on first frame**: when entry is invalid (NaN), driver writes `display="none"`. But mount-ref also runs once before effect — must not skip the display='none' on initial invalid entries. Same `applyAttrs` helper handles both paths.

### Low risk

- **`prev[]` sparseness on shrinking dataset**: leaves stale closure data. JS GC reclaims when prev[] dropped via component teardown. Harmless until then.
- **`onMouseOver`/`onMouseOut` with bar-internal hover transitions**: e.g. user adds a `<title>` inside path. mouseover/out target traversal handles.

### Watchlist for regression review

- BarChart with stackId — verify clip-path applied per index.
- BarChart + ErrorBar children — ErrorBar provider must still wrap. Driver lives below `<SetErrorBarContext>` so unaffected.
- BarChart + Cell children — fill from cell registry → entry.fill → driver writes. Verify `examples/basic` BarNegative still colored.
- `data === undefined` (no chart yet) — outer `<Show when={data}>` gates. Driver never mounts.
- Animation mid-flip (animationId changes during raf) — `JavascriptAnimate` resets `style` to `from`, driver effect fires with t=0 stepData; loop handles same as any other frame.
- 0-bar dataset (`data === []`) — `<For each={[]}>` renders nothing, driver effect runs no-op loop. OK.

## Rollback plan

Revert files:
- `src/cartesian/Bar.tsx` — restore from `git show HEAD:public/solid-ports/recharts/src/cartesian/Bar.tsx`.

No other files touched. No store/selector/context changes. Pure replacement of the rendering branch. Single-file revert.

## File-by-file change list

ONLY:
- `src/cartesian/Bar.tsx` — add `BarImperativeDriver`, swap into `BarRectangles`, narrow `useFastPath`, delete `FastBarPath`.

NOT touched:
- `src/animation/*` — unchanged.
- `src/context/CellsContext.tsx` — unchanged.
- `src/cartesian/BarStack.tsx` — `useBarStackClipPathUrl` already a stable string; reused.
- `src/util/BarUtils.tsx` — unchanged.
- `src/state/selectors/*` — unchanged.
- `test/cartesian/Bar/*` — no test changes expected. If a test fails: investigate first; only migrate with documented justification (e.g. "active-bar test now passes — un-skipped").

## Stop conditions hit?

No. Approach is sound and within Solid's idiomatic limits. One effect, raw DOM mutation under it — Solid does NOT prohibit imperative DOM writes, it just doesn't reactively track them. The classList toggle for active-bar is a separate cheap effect. Single-driver pattern is standard high-perf canvas/SVG rendering technique.
