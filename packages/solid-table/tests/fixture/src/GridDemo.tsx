import { For, Show, createSignal } from "solid-js";
import {
	FlexRender,
	aggregationFns,
	createExpandedRowModel,
	createFilteredRowModel,
	createGroupedRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	createTable,
	filterFns,
	sortFns,
	stockFeatures,
} from "@solidports/solid-table";
import { people } from "./data";
import type { ColumnDef, RowSelectionState } from "@solidports/solid-table";
import type { Person } from "./data";

const features = {
	...stockFeatures,
	aggregationFns,
	expandedRowModel: createExpandedRowModel(),
	filterFns,
	filteredRowModel: createFilteredRowModel(),
	groupedRowModel: createGroupedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortFns,
	sortedRowModel: createSortedRowModel(),
};

const columns: Array<ColumnDef<typeof features, Person>> = [
	{
		id: "select",
		size: 40,
		enableResizing: false,
		header: ({ table }) => (
			<input
				type="checkbox"
				aria-label="Select all"
				checked={table.getIsAllRowsSelected()}
				onChange={table.getToggleAllRowsSelectedHandler()}
			/>
		),
		cell: ({ row }) => (
			<input
				type="checkbox"
				aria-label={`Select ${row.original.name}`}
				checked={row.getIsSelected()}
				onChange={row.getToggleSelectedHandler()}
			/>
		),
	},
	{
		id: "name",
		accessorKey: "name",
		header: "Name",
		cell: ({ row, getValue }) => (
			<span style={{ "padding-left": `${row.depth * 16}px` }}>
				<Show when={row.getCanExpand()}>
					<button aria-label={`Expand ${row.original.name}`} onClick={row.getToggleExpandedHandler()}>
						{row.getIsExpanded() ? "-" : "+"}
					</button>
				</Show>
				{String(getValue())}
			</span>
		),
	},
	{
		id: "team",
		accessorKey: "team",
		header: "Team",
		cell: ({ row, getValue }) =>
			row.getIsGrouped() ? (
				<button aria-label={`Toggle group ${String(getValue())}`} onClick={row.getToggleExpandedHandler()}>
					{`${String(getValue())} (${row.subRows.length})`}
				</button>
			) : (
				String(getValue())
			),
	},
	{
		id: "age",
		accessorKey: "age",
		header: "Age",
		cell: (info) => String(info.getValue()),
		aggregationFn: "max",
		aggregatedCell: (info) => `max ${info.getValue()}`,
	},
];

export function GridDemo() {
	/* Selection is controlled from outside the table to exercise options.state + on*Change. */
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});

	const table = createTable({
		features,
		columns,
		data: people,
		getRowId: (row) => row.id,
		getSubRows: (row) => row.reports,
		columnResizeMode: "onChange",
		state: {
			get rowSelection() {
				return rowSelection();
			},
		},
		onRowSelectionChange: setRowSelection,
		initialState: { pagination: { pageIndex: 0, pageSize: 4 } },
	});

	return (
		<section>
			<div>
				<input
					aria-label="Global filter"
					placeholder="Search"
					value={table.atoms.globalFilter.get() ?? ""}
					onInput={(e) => table.setGlobalFilter(e.currentTarget.value)}
				/>
				<input
					aria-label="Team filter"
					placeholder="Team"
					value={String(table.getColumn("team")!.getFilterValue() ?? "")}
					onInput={(e) => table.getColumn("team")!.setFilterValue(e.currentTarget.value || undefined)}
				/>
				<For each={table.getAllLeafColumns().filter((c) => c.id !== "select")}>
					{(column) => (
						<label>
							<input
								type="checkbox"
								aria-label={`Show ${column.id}`}
								checked={column.getIsVisible()}
								onChange={column.getToggleVisibilityHandler()}
							/>
							{column.id}
						</label>
					)}
				</For>
				<button onClick={() => table.getColumn("age")!.pin(table.getColumn("age")!.getIsPinned() ? false : "start")}>
					Pin age
				</button>
				<button onClick={() => table.setGrouping((g) => (g.length ? [] : ["team"]))}>Group by team</button>
				<button onClick={() => table.reset()}>Reset</button>
			</div>

			<table style={{ "table-layout": "fixed", width: `${table.getTotalSize()}px` }}>
				<thead>
					<For each={table.getHeaderGroups()}>
						{(headerGroup) => (
							<tr>
								<For each={[...headerGroup.headers].sort((a, b) => pinRank(a) - pinRank(b))}>
									{(header) => (
										<th
											data-column={header.column.id}
											style={{ width: `${header.getSize()}px`, position: "relative" }}
											aria-sort={
												header.column.getIsSorted() === "asc"
													? "ascending"
													: header.column.getIsSorted() === "desc"
														? "descending"
														: "none"
											}
										>
											<span onClick={(e) => header.column.getToggleSortingHandler()?.(e)}>
												<FlexRender header={header} />
											</span>
											<Show when={header.column.getCanResize()}>
												<div
													data-resizer={header.column.id}
													onMouseDown={(e) => header.getResizeHandler()(e)}
													style={{
														position: "absolute",
														right: "0",
														top: "0",
														width: "6px",
														height: "100%",
														cursor: "col-resize",
														background: "#ccc",
													}}
												/>
											</Show>
										</th>
									)}
								</For>
							</tr>
						)}
					</For>
				</thead>
				<tbody>
					<For each={table.getRowModel().rows}>
						{(row) => (
							<tr data-row={row.id}>
								<For each={[...row.getVisibleCells()].sort((a, b) => pinRank(a) - pinRank(b))}>
									{(cell) => (
										<td data-column={cell.column.id}>
											<FlexRender cell={cell} />
										</td>
									)}
								</For>
							</tr>
						)}
					</For>
				</tbody>
			</table>

			<div>
				<button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
					Previous
				</button>
				<output aria-label="Page">{`${table.atoms.pagination.get().pageIndex + 1}/${table.getPageCount()}`}</output>
				<button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
					Next
				</button>
				<output aria-label="Selection">{Object.keys(rowSelection()).sort().join(",")}</output>
			</div>
		</section>
	);
}

function pinRank(item: { column: { getIsPinned: () => false | "start" | "end" } }) {
	const pinned = item.column.getIsPinned();
	return pinned === "start" ? 0 : pinned === "end" ? 2 : 1;
}
