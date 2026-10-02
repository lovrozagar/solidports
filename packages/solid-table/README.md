# @solidports/solid-table

Solid 2 adapter for [TanStack Table](https://tanstack.com/table) v9. It is a thin layer over `@tanstack/table-core` with the same API and entry points as `@tanstack/solid-table`, which does not support Solid 2 yet (tracked in [TanStack/table#6242](https://github.com/TanStack/table/pull/6242)).

Temporary package. When upstream ships Solid 2 support, swap the import and delete this package.

## Install

`@tanstack/table-core` is a peer dependency, so the app owns its version.

```sh
bun add @solidports/solid-table @tanstack/table-core
```

## Usage

```tsx
import { For } from "solid-js";
import { FlexRender, createTable, stockFeatures } from "@solidports/solid-table";

const table = createTable({
	features: stockFeatures,
	columns,
	get data() {
		return data();
	},
});

<For each={table.getRowModel().rows}>
	{(row) => (
		<tr>
			<For each={row.getVisibleCells()}>
				{(cell) => (
					<td>
						<FlexRender cell={cell} />
					</td>
				)}
			</For>
		</tr>
	)}
</For>;
```

Entry points mirror upstream: `.`, `./flex-render`, `./static-functions`, `./experimental-worker-plugin`.

## Swapping to upstream

1. Replace `@solidports/solid-table` with `@tanstack/solid-table` in imports.
2. Swap the dependency.
3. Delete this package.

## Solid 2 behavior

- **Writes land on flush.** `table.setSorting(...)` updates reads after the next microtask or `flush()`, like any Solid 2 signal. Updaters still chain before the flush: two `table.nextPage()` calls advance two pages. In tests, `flush()` before asserting.
- **Column templates run once per cell or header instance.** As in Solid 1, top-level reads in `cell`, `header`, and `footer` are snapshots. New data creates new cell instances, so `info.getValue()` stays current. Put reads that must react to table state in the returned JSX, for example `checked={row.getIsSelected()}`.
- **Read the table in JSX or memos.** Reading `table.getRowModel()` at the top of a component body triggers Solid's `STRICT_READ_UNTRACKED` warning. Wrap it in `untrack` if you want a one-time snapshot.

## Virtualization

`@tanstack/solid-virtual` is Solid 1 only. Drive `@tanstack/virtual-core` directly; `tests/fixture/src/VirtualDemo.tsx` shows a 10k-row table.

## Testing

- `bun run test`: jsdom suite on the Solid dev build, plus server rendering. Solid dev diagnostics fail the run.
- `bun run test:prod`: the jsdom suite on Solid's production build.
- `bun run test:e2e`: Playwright in Chromium against the fixture app, on both the dev server and a production build. Console warnings and errors fail the run.

## Differences from upstream

- Controlled state: base state atoms are writable derived signals over `options.state[key]`, so they follow controlled state in the same flush. Upstream syncs them with `createComputed`, which Solid 2 removed. An effect-based sync would lag a flush and trigger `EFFECT_RELAY_TEAR`.
- `createTableHook`: `AppHeader` and `AppFooter` choose the header or footer template through context, not by assigning a different `FlexRender` onto the header instance. A leaf column's header and footer are the same object, so upstream's assignment collides.
