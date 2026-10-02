# @solidports/recharts-examples-basic

Solid port visual harness. Each route renders a chart type via `@solidports/recharts`.

Designed to run **side-by-side** with `examples/react` (upstream React `recharts@3.10.1`)
on a different port for pixel-level visual diff.

## Quick start

```bash
# Solid port app — http://localhost:5183
cd packages/recharts/examples/basic
bun install
bun run dev

# React reference app (upstream recharts) — http://localhost:5184
cd ../react
bun install
bun run dev
```

Open both URLs. Sidebar routes match 1:1. Same upstream sample data on both sides.

## Build

```bash
bun run build
bun run preview
```

## Data

`src/data/` is verbatim from upstream `recharts@3.8.1` `storybook/stories/data/`
(MIT — see root `LICENSE`). Both example apps consume the same files so their
inputs are identical and any visual diff is purely the port's behaviour.

## Routes

LineChart · BarChart · AreaChart · ComposedChart · PieChart · RadarChart ·
RadialBarChart · ScatterChart · FunnelChart · SankeyChart · TreemapChart ·
SunburstChart.

Hash-based routing — no router dependency.

## Adding a new example

1. Create `src/examples/<Name>.tsx` exporting a `Component`.
2. Register it in `src/App.tsx` `routes`.
3. Mirror the same story in `../react/src/examples/<Name>.tsx` so the diff stays valid.
4. If a new dataset is needed, copy it verbatim from upstream into `src/data/`
   AND `../react/src/data/`.

Imports must come from `@solidports/recharts` only — never reach into `dist`
or `src` paths from the parent package.
