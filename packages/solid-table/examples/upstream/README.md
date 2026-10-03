# TanStack Table examples on Solid 2

TanStack's official Solid examples ([TanStack/table `examples/solid`](https://github.com/TanStack/table/tree/main/examples/solid), commit `23f21c1`), each on its own page, running on Solid 2.

The examples import `@tanstack/solid-table` exactly as upstream writes them. Vite aliases that import to `@solidports/solid-table`.

```sh
bun run dev            # http://localhost:4120, Solid 2 adapter from this repo
bun run dev:upstream   # same pages on the real @tanstack/solid-table (fails: it imports solid-js/web)
```

## Included

25 of TanStack's 39 examples. The other 14 need TanStack libraries that are still Solid 1 only (`solid-virtual`, `solid-query`, `solid-form`, `solid-router`, `solid-pacer`, `solid-hotkeys`, `solid-store`).

## Changes from upstream

Devtools are removed (Solid 1 only). The rest is the minimum to run on Solid 2:

- `solid-js/web` → `@solidjs/web`, `colSpan`/`rowSpan` → `colspan`/`rowspan`, `splitProps` → `omit`, `JSX` type from `@solidjs/web`.
- Single-argument `createEffect` → the two-argument form (`IndeterminateCheckbox`, kitchen-sink `DebouncedInput`).
- `onClick={x.getToggle…Handler()}` → `onClick={(e) => x.getToggle…Handler()?.(e)}`. Solid binds handlers once, so the getter form captured table state at render.
- Top-level reads in components: one-time reads wrapped in `untrack`, live ones moved into accessors. This fixes upstream's composable-tables `FooterSum`, which never updated after filtering.
- kitchen-sink `columnSizeVars` memo gets an `equals` so unchanged sizes don't re-run subscribers.

## Known upstream bug

kitchen-sink can throw `getRow could not find row with ID: firstName:…` after pinning rows while grouped and then filtering. Unmodified upstream on Solid 1 with `@tanstack/solid-table` 9.2.4 throws the same error, so it's a `@tanstack/table-core` bug.
