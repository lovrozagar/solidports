import { For, createSignal } from "solid-js";
import { createSortedRowModel, createTableHook, sortFns, stockFeatures } from "@solidports/solid-table";
import { people } from "./data";
import type { SortingState } from "@solidports/solid-table";
import type { Person } from "./data";

function SortIndicator() {
	const header = hook.useHeaderContext();
	return (
		<span data-sort-indicator>
			{({ asc: "▲", desc: "▼" } as Record<string, string>)[header.column.getIsSorted() || ""] ?? ""}
		</span>
	);
}

function SelectedBadge() {
	const cell = hook.useCellContext();
	return <span data-selected={String(cell.row.getIsSelected())}>{cell.row.getIsSelected() ? "✓" : ""}</span>;
}

function RowCount() {
	const table = hook.useTableContext<Person>();
	return <output aria-label="Row count">{table.getRowModel().rows.length}</output>;
}

const hook = createTableHook({
	features: { ...stockFeatures, sortFns, sortedRowModel: createSortedRowModel() },
	getRowId: (row: Person) => row.id,
	tableComponents: { RowCount },
	cellComponents: { SelectedBadge },
	headerComponents: { SortIndicator },
});

const helper = hook.createAppColumnHelper<Person>();
const columns = helper.columns([
	helper.accessor("name", { header: "Name", footer: "names", cell: (info) => info.getValue() }),
	helper.accessor("age", {
		header: "Age",
		footer: ({ table }) => `rows ${table.getRowModel().rows.length}`,
		cell: (info) => String(info.getValue()),
	}),
]);

export function HookDemo() {
	const [sorting, setSorting] = createSignal<SortingState>([]);
	const table = hook.createAppTable({
		columns,
		data: people,
		state: {
			get sorting() {
				return sorting();
			},
		},
		onSortingChange: setSorting,
	});

	return (
		<table.AppTable>
			<table>
				<thead>
					<For each={table.getHeaderGroups()}>
						{(group) => (
							<tr>
								<For each={group.headers}>
									{(header) => (
										<table.AppHeader header={header}>
											{(h) => (
												<th data-column={h.column.id} onClick={(e) => h.column.getToggleSortingHandler()?.(e)}>
													<h.FlexRender />
													<h.SortIndicator />
												</th>
											)}
										</table.AppHeader>
									)}
								</For>
							</tr>
						)}
					</For>
				</thead>
				<tbody>
					<For each={table.getRowModel().rows}>
						{(row) => (
							<tr data-row={row.id} onClick={() => row.toggleSelected()}>
								<For each={row.getVisibleCells()}>
									{(cell) => (
										<table.AppCell cell={cell}>
											{(c) => (
												<td>
													<c.FlexRender />
													<c.SelectedBadge />
												</td>
											)}
										</table.AppCell>
									)}
								</For>
							</tr>
						)}
					</For>
				</tbody>
				<tfoot>
					<For each={table.getFooterGroups()}>
						{(group) => (
							<tr>
								<For each={group.headers}>
									{(header) => (
										<table.AppFooter header={header}>
											{(f) => (
												<td data-footer={f.column.id}>
													<f.FlexRender />
												</td>
											)}
										</table.AppFooter>
									)}
								</For>
							</tr>
						)}
					</For>
				</tfoot>
			</table>
			<table.RowCount />
			<output aria-label="Sorting">{JSON.stringify(sorting())}</output>
		</table.AppTable>
	);
}
