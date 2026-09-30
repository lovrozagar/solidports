# @solidports/recharts

SolidJS 1:1 port of [recharts](https://recharts.org) — drop-in migration, same API.

**Parity: tests 28%** (1224 / 4338 passing — Phase 3 target: 95%)

## Install

```bash
bun add @solidports/recharts solid-js
```

```bash
npm install @solidports/recharts solid-js
```

```bash
pnpm add @solidports/recharts solid-js
```

```bash
yarn add @solidports/recharts solid-js
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

Public API is 1:1 with recharts v3.8.1 — see https://recharts.org/en-US/api.

## Examples

A live Vite + Solid harness covering every public chart type lives in [`examples/basic`](./examples/basic/README.md).

```bash
cd examples/basic
bun install
bun run dev
```

## Divergences from upstream

- **ESM-only.** Solid ecosystem is ESM-first; no CJS output.
- **`className` preserved.** All components accept `className` (not `class`) for drop-in parity. At native SVG/HTML boundaries, `className` maps to `class` internally.
- **`on:event` directives.** Native DOM event passthrough uses Solid's `on:` prefix where needed for cross-boundary events.
- **No `React.cloneElement`.** Render-prop pattern used instead: `<Tooltip content={(ctx) => <Custom payload={ctx.payload} />} />`.
- **Animation.** Custom Solid animation manager (port of react-smooth internals) — same visual output, no react-smooth dependency.

## Porting status

```
Charts      ported (build passes, tests WIP)
Cartesian   ported (build passes, tests WIP)
Polar       ported (build passes, tests WIP)
Components  ported (build passes, tests WIP)
Shapes      ported (build passes, tests WIP)
Hooks       ported (build passes, tests WIP)
```

Full test green target: Phase 3. See [metaspec](.workerc/specs/) for roadmap.

## API parity

```
Upstream exports        216
Solid exports           206
Common (shared)         205
Missing exports         0
Kind drift              0
Unexplained extras      0
Solid-only allowlisted  1   (_SolidJSXCamelAugmentMarker — see .kb/parity/divergences.md)
Deferred unported       11  (typed-chart factories — see .kb/parity/todo.md)
```

Run the audit yourself:

```bash
bun run parity
```

Reports land in `.parity/report.json` and `.kb/parity/report.md`. Documented React→Solid type-equivalents (children, refs, events, CSS/SVG, etc.) live in `.kb/parity/divergences.md`.

## Attribution

Ported from [recharts](https://github.com/recharts/recharts) (MIT).
Upstream pinned at v3.8.1. See [NOTICE](./NOTICE) for details.

## License

MIT — see [LICENSE](./LICENSE).
