---
title: Debug: Cell fill not applied in Bar (BarNegative black bars)
session: 20260426-2006
spec: None
status: active
---

## Current Focus

hypothesis: Cell children are silently dropped in Bar (and other graphical items). Implementing CellsContext registration pattern so <Cell> can hand its props up to <Bar> at setup time. Solid cannot introspect JSX, so registry is the parity mechanism.
test: BarNegative renders 6 black bars; after fix expect 6 bars with var(--chart-1)/var(--chart-2) resolved.
next: implement CellsContext, wire Cell + Bar, run triage, verify with Playwright.

## Symptoms

expected: Bars in BarNegative example render in oklch(0.646 0.222 41.116) (chart-1) for positive values and oklch(0.6 0.118 184.704) (chart-2) for negative.
actual: 6 bars in BarNegative render with computed fill rgb(0,0,0). The path elements have NO `fill` attribute (not "var(--...)" — just absent).
errors: none thrown.
reproduction: localhost:5175 BarNegative card, inspect path.recharts-rectangle inside .recharts-inactive-bar.

## Eliminated

- Original report: var() in SVG fill ATTRIBUTE not resolving. Disproven via Playwright — Chrome resolves var() in fill attr correctly. The other 94 bars on the page resolve to oklch(...) computed fill from `fill="var(--color-desktop)"` attribute alone.

## Evidence

- BarNegative.tsx: uses <For each={negativeData}>{row => <Cell fill={...} />}</For> inside Bar. Cell component is "deprecated stub" returning null in Solid port.
- Bar.tsx line 648-649: `const cells = (): ReadonlyArray<JSX.Element> | undefined => undefined` — explicitly stubbed because findAllByType is no-op in Solid (JSX is opaque).
- selectBarRectangles already accepts `cells` and computeBarRectangles spreads `cells[index].props` into the BarRectangleItem (line 826) — plumbing is in place.
- Same pattern in Pie/Scatter/Funnel/RadialBar — all stub cells as undefined.

## Log

- [x] (20260426-2006) (debug) Confirmed root cause: Cell children dropped, not var() resolution.
- [x] (20260426-2010) (impl) Added src/context/CellsContext.tsx — registry-based pattern.
- [x] (20260426-2015) (impl) Wired Cell to register; first attempt put Provider inside BarImpl — Cell logged registry=false because memoizedChildren memo's owner predates Provider.
- [x] (20260426-2025) (impl) Hoisted Provider to BarChildrenScope wrapper component — registry created in component scope, Provider wraps memo creation site so For/Cell createComponent calls walk into Provider.
- [x] (20260426-2027) (verify) Triage 0 failures, tsc 0, oxlint 0. shadcn 5175: 100/100 bars colored (was 6 black). basic 5173: 28/28 bars colored, no regression.

status: done

