---
title: Bar imperative single-driver — beat React perf
session: 20260426-bar-imperative-driver
status: executor-done
---

## Summary

Replaced per-bar `<Index>+<FastBarPath>+createEffect` model with single `BarImperativeDriver` owning all default-shape paths. One `createEffect` reads `props.data` and writes all paths' attrs in a tight `for` loop. Active-bar swap and event delegation are separate cheap effects/listeners on the driver root.

## Files

- `src/cartesian/Bar.tsx` — added `BarImperativeDriver`, narrowed `useFastPath`, deleted `FastBarPath`, swapped fast-path render branch.

## Implementation notes

- `<For>` originally per spec — switched to `<Index>` because `stepData()` returns NEW array refs each frame; `<For>` keyed by reference would tear down/remount every row per raf. Index keeps slots stable.
- Path's `class` attr managed imperatively in `applyAttrs` (not via JSX `class={...}` reactive binding). Toggling between `recharts-rectangle ...` (valid) and `""` (invalid) replaces the prior `<Show when={isValid()}>` mount semantics — `expectBars` selector `.recharts-rectangle` no longer matches when invalid, matching baseline behavior. Tradeoff: dynamic `className` prop changes on Bar are not propagated to the path post-mount (out-of-scope optimization for fast path).
- Initial mount: path's `ref` callback synchronously calls `applyAttrs` so first frame paints with correct geometry — no flash of un-attributed paths before the first effect tick.
- `radius` attribute set imperatively in ref callback (mirrors prior `setPathRef`).
- Active-bar handling: separate `createEffect` reads `selectActiveTooltipIndex` + `selectActiveTooltipDataKey`, toggles `recharts-active-bar`/`recharts-inactive-bar` on inner wrapper. Boolean `activeBar=true` only — object/fn/JSX activeBar falls back to slow path (existing `<Index>` chain) since those need ZIndex hoist + per-row option rebuild.
- Event delegation: 3 JSX-bound delegates on driver root for `onMouseOver`/`onMouseOut`/`onClick` (most common path). Other event types from `eventHandlers` (e.g. `onTouchMove`, `onPointerDown`) attached via `addEventListener` in `onMount`, cleaned up in `onCleanup`. Walks up from `e.target` to find `.recharts-bar-rectangle` wrapper, looks up index from `wrappers[]` array.
- `findIndex` uses `classList.contains` rather than `instanceof SVGGElement` since jsdom doesn't expose `SVGGElement` as a global.
- `onClick` delegate doesn't call `eventHandlers.onClick` directly because `useMouseClickItemDispatch` already invokes user `onClick` via `readHandler`. `onMouseOver`/`onMouseOut` DO call `eventHandlers.onMouseOver`/`onMouseOut` — those are NOT invoked by the enter/leave dispatchers (which fire `onMouseEnter`/`onMouseLeave`).

## Acceptance gates

- TypeCheck: 0 errors
- Lint: 0 errors (43 pre-existing warnings — no-cycle, reactivity, unused imports — all unrelated)
- Tests: 137/137 Bar tests pass (148 with 11 pre-existing skips)
- Triage: 0 (BarStack 50/50, BarChart 48/48 still green)

## Out of scope (per spec)

- Background bars (`<BarBackground>`) — unchanged
- Custom `shape` / object-or-fn `activeBar` — slow path retained
- Visual diff + perf measurement — orchestrator gate
