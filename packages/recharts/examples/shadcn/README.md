# @solidports/recharts-examples-shadcn

Solid port of the [shadcn/ui charts](https://ui.shadcn.com/charts/bar) bar chart variants, built on `@solidports/recharts`.

## What is included

- `src/lib/chart.tsx` — Solid port of shadcn's `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartConfig` and the `useChart` context.
- `src/lib/utils.ts` — `cn()` helper backed by `clsx`.
- `src/app.css` — Tailwind v4 entry plus shadcn theme variables (`--background`, `--foreground`, `--chart-1..5`, etc.) for both light and dark modes.
- `src/data.ts` — example datasets matching the shadcn docs.
- `src/examples/Bar*.tsx` — bar chart variants (default, horizontal, multiple, stacked, stacked + legend, active, negative, custom label, mixed, interactive).
- `src/App.tsx` + `src/main.tsx` — gallery page rendering all variants on a single route.

## Run

```bash
# install workspace deps from monorepo root once
bun install

cd public/solid-ports/recharts/examples/shadcn
bun run dev      # http://localhost:5175
bun run build    # vite build → dist/
bun run preview  # serve dist on :5175
```

## Notes on the React → Solid port

- `forwardRef` removed — Solid components accept a plain `ref` prop where needed.
- `React.useMemo` → `createMemo`; `useState` → `createSignal`; `useEffect` → `createEffect`.
- `Children.map`/`cloneElement` are not needed — payload is passed directly through `ChartContainer` to recharts via the `<ResponsiveContainer>` child.
- Class merging uses `clsx` instead of `tailwind-merge` (Tailwind v4 layer order resolves most conflicts on its own; if a project needs explicit merging, swap `cn()` to use `tailwind-merge`).
- shadcn's React `ChartTooltipContent` uses fully-typed `TooltipPayloadEntry` items. Same here — no `any` casts.
- shadcn uses an `activeIndex` + `activeBar` API on the React port. The Solid recharts port currently exposes only the `shape` callback on `Bar`, so the "Active" variant uses `shape={(p) => p.index === 2 ? <Highlight /> : <Default />}`. Visually equivalent.

## Variants

1. Bar Chart — Default
2. Bar Chart — Horizontal
3. Bar Chart — Multiple
4. Bar Chart — Stacked
5. Bar Chart — Stacked + Legend
6. Bar Chart — Active
7. Bar Chart — Negative
8. Bar Chart — Custom Label
9. Bar Chart — Mixed
10. Bar Chart — Interactive (top of the page)
