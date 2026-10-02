# @solidports/recharts

SolidJS 1:1 port of [recharts](https://recharts.org) — drop-in migration, same API.

**Upstream: recharts v3.10.1.** Tests: 6202 passing, 0 failing; the only skips (17) are the ones upstream's own suite skips. Public API parity: 251 / 251 exports.

## Install

```bash
bun add @solidports/recharts solid-js @solidjs/web
```

```bash
npm install @solidports/recharts solid-js @solidjs/web
```

```bash
pnpm add @solidports/recharts solid-js @solidjs/web
```

```bash
yarn add @solidports/recharts solid-js @solidjs/web
```

## Usage

```tsx
import { LineChart, XAxis, Line } from "@solidports/recharts"

const data = [
  { name: "Jan", uv: 400 },
  { name: "Feb", uv: 300 },
  { name: "Mar", uv: 600 },
]

export function MyChart() {
  return (
    <LineChart width={500} height={300} data={data}>
      <XAxis dataKey="name" />
      <Line type="monotone" dataKey="uv" stroke="#8884d8" />
    </LineChart>
  )
}
```

## API

Public API is 1:1 with recharts v3.10.1 — see https://recharts.org/en-US/api.

## Examples

A live Vite + Solid harness covering every public chart type lives in [`examples/basic`](./examples/basic/README.md).

```bash
cd examples/basic
bun install
bun run dev
```

## Architecture

Each chart owns one Solid store, `createStore<ChartState>` (`src/state/chartState.ts`). Upstream's Redux slices became plain state branches, its reducers became `createActions` mutations, and its reselect selectors became plain functions that consumers memoize with `createMemo`. Fine-grained store reads replace `useSelector`. Chart data is stored by reference, not proxied row by row, so replace the `data` array to update a chart, as with upstream. See `.kb/solid/store-semantics.md`.

## Divergences from upstream

- **ESM-only.** The Solid ecosystem is ESM-first; there is no CJS output.
- **`className` preserved.** Components accept `className` for drop-in parity; it maps to `class` at the DOM boundary.
- **Elements as props.** `shape={<Rectangle fill="red" />}`, `activeShape` and the Reference* `shape` props accept built-in recharts shape elements (Rectangle, Sector, Trapezoid, Symbols, Dot, Curve, Cross, Polygon), which receive the injected props the way `cloneElement` does upstream. A custom component should be passed as the component or a function (`shape={MyShape}` or `shape={(props) => <MyShape {...props} />}`): Solid evaluates `<MyShape />` eagerly, before recharts can add props.
- **Events.** Handlers receive native DOM events, not React synthetic events.
- **No re-render counts.** Solid components run once, so selector and render-call counts are lower than React's. Tests that counted React renders were adjusted with a comment.
- **Animation.** The upstream 3.9 animation controller (`AnimationController`, `AnimatedItems`) is ported directly; there is no react-smooth dependency.

Type-level equivalents (children, refs, events, CSS/SVG attributes) are listed in `.kb/parity/divergences.md`.

## API parity

```
Upstream exports        251
Solid exports           252
Missing exports         0
Kind drift              0
Unexplained extras      0
Deferred                0
Solid-only allowlisted  1   (_SolidJSXCamelAugmentMarker — see .kb/parity/divergences.md)
```

Run the audit yourself:

```bash
bun run parity
```

Reports land in `.parity/report.json` and `.kb/parity/report.md`. Documented React→Solid type-equivalents (children, refs, events, CSS/SVG, etc.) live in `.kb/parity/divergences.md`.

## Attribution

Ported from [recharts](https://github.com/recharts/recharts) (MIT).
Upstream pinned at v3.10.1. See [NOTICE](./NOTICE) for details.

## License

MIT — see [LICENSE](./LICENSE).
