# @solidports/recharts-examples-react

React reference harness using upstream `recharts@3.8.1`. Mirror of
`examples/basic` for side-by-side visual comparison against the SolidJS port.

This app exists **only** as a visual baseline — every story renders the same
data and the same prop values as its Solid sibling, so any rendering
difference is attributable to the port.

## Quick start

```bash
# React reference app — :5174
cd public/solid-ports/recharts/examples/react
bun install
bun run dev

# Solid port app — :5173
cd ../basic
bun install
bun run dev
```

Open both URLs and switch routes with the sidebar.

## Build

```bash
bun run build
bun run preview      # serves on :5174
```

## Data

`src/data/` is verbatim from upstream `recharts@3.8.1`
`storybook/stories/data/` (MIT — see root `LICENSE`). The Solid app consumes
identical copies under `examples/basic/src/data/`.

## Routes

LineChart · BarChart · AreaChart · ComposedChart · PieChart · RadarChart ·
RadialBarChart · ScatterChart · FunnelChart · SankeyChart · TreemapChart ·
SunburstChart.

Hash-based routing — no router dependency.

## Updating the recharts pin

This app pins `recharts` via the workspace catalog. To bump the reference
version, update `recharts` in the root `package.json` `workspaces.catalog`
and re-run `bun install`. Keep the pin in lock-step with
`.upstream/cache/recharts-v<x>/` to ensure the data fixtures still match.
