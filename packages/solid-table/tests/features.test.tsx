import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { For, createEffect, createSignal, flush } from "solid-js";
import {
	aggregationFns,
	createExpandedRowModel,
	createFacetedMinMaxValues,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createGroupedRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFns,
	sortFns,
	stockFeatures,
} from "@tanstack/table-core";
import { FlexRender } from "../src/FlexRender";
import { createTable } from "../src/createTable";
import { createTestRoot } from "./helpers";
import type { ColumnDef, SortingState } from "@tanstack/table-core";

afterEach(() => cleanup());

type Person = { id: string; name: string; team: string; age: number; reports?: Array<Person> };

const features = {
	...stockFeatures,
	aggregationFns,
	expandedRowModel: createExpandedRowModel(),
	facetedMinMaxValues: createFacetedMinMaxValues(),
	facetedRowModel: createFacetedRowModel(),
	facetedUniqueValues: createFacetedUniqueValues(),
	filterFns,
	filteredRowModel: createFilteredRowModel(),
	groupedRowModel: createGroupedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortFns,
	sortedRowModel: createSortedRowModel(),
};

const people: Array<Person> = [
	{ id: "1", name: "Ada", team: "core", age: 36 },
	{ id: "2", name: "Grace", team: "compiler", age: 85 },
	{ id: "3", name: "Linus", team: "core", age: 54 },
	{ id: "4", name: "Margaret", team: "apollo", age: 33 },
	{ id: "5", name: "Ken", team: "compiler", age: 80 },
];

const columns: Array<ColumnDef<typeof features, Person>> = [
	{ id: "name", accessorKey: "name", header: "Name", cell: (info) => info.getValue() },
	{
		id: "team",
		accessorKey: "team",
		header: "Team",
		cell: (info) => info.getValue(),
		aggregatedCell: (info) => `${info.getValue()} (${info.row.subRows.length})`,
	},
	{
		id: "age",
		accessorKey: "age",
		header: "Age",
		cell: (info) => String(info.getValue()),
		aggregationFn: "mean",
		aggregatedCell: (info) => `avg ${info.getValue()}`,
	},
];

function newTable(options: Partial<Parameters<typeof createTable<typeof features, Person>>[0]> = {}) {
	return createTable({ features, columns, data: people, getRowId: (row) => row.id, ...options });
}

const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
/* Reads the row model reactively, like a rendered table body. table-core skips auto
   resets on a row model's first computation, so something must have rendered it. */
function renderRows<T extends ReturnType<typeof newTable>>(table: T) {
	createEffect(
		() => table.getRowModel().rows.length,
		() => {},
	);
	return table;
}

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("column features", () => {
	test("visibility, ordering, and pinning reshape headers and cells", () => {
		const { dispose, value: table } = createTestRoot(() => newTable());
		const headerIds = () => table.getFlatHeaders().map((h) => h.column.id);
		const firstRowCells = () =>
			table
				.getRowModel()
				.rows[0]!.getVisibleCells()
				.map((c) => c.column.id);

		try {
			table.getColumn("team")!.toggleVisibility(false);
			flush();
			expect(firstRowCells()).toEqual(["name", "age"]);
			expect(table.getVisibleLeafColumns().map((c) => c.id)).toEqual(["name", "age"]);

			table.getColumn("team")!.toggleVisibility(true);
			table.setColumnOrder(["age", "team", "name"]);
			flush();
			expect(firstRowCells()).toEqual(["age", "team", "name"]);
			expect(headerIds()).toEqual(["age", "team", "name"]);

			table.getColumn("name")!.pin("start");
			flush();
			const row = table.getRowModel().rows[0]!;
			expect(row.getStartVisibleCells().map((c) => c.column.id)).toEqual(["name"]);
			expect(row.getCenterVisibleCells().map((c) => c.column.id)).toEqual(["age", "team"]);
			expect(table.getColumn("name")!.getIsPinned()).toBe("start");
		} finally {
			dispose();
		}
	});

	test("column sizing and drag resizing commit new widths", () => {
		const { dispose, value: table } = createTestRoot(() => newTable({ columnResizeMode: "onEnd" }));

		try {
			table.setColumnSizing({ name: 200 });
			flush();
			expect(table.getColumn("name")!.getSize()).toBe(200);

			const header = table.getFlatHeaders().find((h) => h.column.id === "name")!;
			header.getResizeHandler()(new MouseEvent("mousedown", { clientX: 100 }));
			flush();
			expect(table.getColumn("name")!.getIsResizing()).toBe(true);

			document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }));
			flush();
			expect(table.getColumn("name")!.getSize()).toBe(200);

			document.dispatchEvent(new MouseEvent("mouseup", { clientX: 150 }));
			flush();
			expect(table.getColumn("name")!.getSize()).toBe(250);
			expect(table.getColumn("name")!.getIsResizing()).toBe(false);
		} finally {
			dispose();
		}
	});

	test("onChange resize mode commits during the drag", () => {
		const { dispose, value: table } = createTestRoot(() => newTable({ columnResizeMode: "onChange" }));

		try {
			table.setColumnSizing({ name: 100 });
			flush();
			const header = table.getFlatHeaders().find((h) => h.column.id === "name")!;
			header.getResizeHandler()(new MouseEvent("mousedown", { clientX: 0 }));
			document.dispatchEvent(new MouseEvent("mousemove", { clientX: 40 }));
			flush();
			expect(table.getColumn("name")!.getSize()).toBe(140);
			document.dispatchEvent(new MouseEvent("mouseup", { clientX: 60 }));
			flush();
			expect(table.getColumn("name")!.getSize()).toBe(160);
		} finally {
			dispose();
		}
	});
});

describe("row features", () => {
	test("grouping aggregates and expanding reveals grouped rows", () => {
		const { dispose, value: table } = createTestRoot(() => newTable());

		try {
			table.setGrouping(["team"]);
			flush();
			const groups = table.getRowModel().rows;
			expect(groups.map((r) => r.getGroupingValue("team"))).toEqual(["core", "compiler", "apollo"]);
			expect(groups[0]!.getValue("age")).toBe(45);
			expect(groups[0]!.getIsExpanded()).toBe(false);

			groups[0]!.toggleExpanded(true);
			flush();
			expect(ids(table.getRowModel().rows)).toEqual(["team:core", "1", "3", "team:compiler", "team:apollo"]);

			table.toggleAllRowsExpanded(true);
			flush();
			expect(table.getRowModel().rows).toHaveLength(8);
		} finally {
			dispose();
		}
	});

	test("sub-rows expand and filter through their parents", () => {
		const tree: Array<Person> = [
			{
				id: "a",
				name: "Ada",
				team: "core",
				age: 36,
				reports: [
					{ id: "b", name: "Bob", team: "core", age: 20 },
					{ id: "c", name: "Cy", team: "core", age: 22 },
				],
			},
			{ id: "d", name: "Dee", team: "apollo", age: 40 },
		];
		const { dispose, value: table } = createTestRoot(() =>
			newTable({ data: tree, getSubRows: (row) => row.reports, filterFromLeafRows: true }),
		);

		try {
			expect(ids(table.getRowModel().rows)).toEqual(["a", "d"]);
			expect(table.getRow("a").getCanExpand()).toBe(true);

			table.getRow("a").toggleExpanded();
			flush();
			expect(ids(table.getRowModel().rows)).toEqual(["a", "b", "c", "d"]);
			expect(table.getRow("b").depth).toBe(1);

			table.getColumn("name")!.setFilterValue("Cy");
			flush();
			expect(ids(table.getRowModel().rows)).toEqual(["a", "c"]);
		} finally {
			dispose();
		}
	});

	test("row pinning splits top, center, and bottom rows", () => {
		const { dispose, value: table } = createTestRoot(() => newTable());

		try {
			table.getRow("3").pin("top");
			table.getRow("1").pin("bottom");
			flush();
			expect(ids(table.getTopRows())).toEqual(["3"]);
			expect(ids(table.getBottomRows())).toEqual(["1"]);
			expect(ids(table.getCenterRows())).toEqual(["2", "4", "5"]);
		} finally {
			dispose();
		}
	});

	test("selection counts, sub-row selection, and reset", () => {
		const { dispose, value: table } = createTestRoot(() => newTable());

		try {
			table.getRow("2").toggleSelected(true);
			table.getRow("4").toggleSelected(true);
			flush();
			expect(ids(table.getSelectedRowModel().rows)).toEqual(["2", "4"]);
			expect(table.getIsSomeRowsSelected()).toBe(true);
			expect(table.getIsAllRowsSelected()).toBe(false);

			table.toggleAllRowsSelected(true);
			flush();
			expect(table.getIsAllRowsSelected()).toBe(true);

			table.reset();
			flush();
			expect(table.atoms.rowSelection.get()).toEqual({});
		} finally {
			dispose();
		}
	});
});

describe("filtering and faceting", () => {
	test("global filter, column filters, and faceted values", () => {
		const { dispose, value: table } = createTestRoot(() => newTable());

		try {
			table.setGlobalFilter("ar");
			flush();
			expect(ids(table.getRowModel().rows)).toEqual(["4"]);

			table.setGlobalFilter(undefined);
			table.getColumn("team")!.setFilterValue("core");
			flush();
			expect(ids(table.getRowModel().rows)).toEqual(["1", "3"]);

			const ageFacets = table.getColumn("age")!;
			expect(ageFacets.getFacetedMinMaxValues()).toEqual([36, 54]);
			const teams = table.getColumn("team")!.getFacetedUniqueValues();
			expect([...teams.entries()].sort()).toEqual([
				["apollo", 1],
				["compiler", 2],
				["core", 2],
			]);
		} finally {
			dispose();
		}
	});
});

describe("auto reset", () => {
	test("sorting and filtering reset the page index on the next microtask", async () => {
		const { dispose, value: table } = createTestRoot(() =>
			renderRows(newTable({ initialState: { pagination: { pageIndex: 0, pageSize: 2 } } })),
		);

		try {
			table.nextPage();
			flush();
			expect(table.atoms.pagination.get().pageIndex).toBe(1);

			table.setSorting([{ id: "age", desc: false }]);
			flush();
			await tick();
			flush();
			expect(table.atoms.pagination.get().pageIndex).toBe(0);
			expect(ids(table.getRowModel().rows)).toEqual(["4", "1"]);

			table.nextPage();
			flush();
			table.getColumn("team")!.setFilterValue("co");
			flush();
			await tick();
			flush();
			expect(table.atoms.pagination.get().pageIndex).toBe(0);
		} finally {
			dispose();
		}
	});

	test("autoResetPageIndex: false keeps the page", async () => {
		const { dispose, value: table } = createTestRoot(() =>
			renderRows(newTable({ autoResetPageIndex: false, initialState: { pagination: { pageIndex: 1, pageSize: 2 } } })),
		);

		try {
			table.setSorting([{ id: "age", desc: true }]);
			flush();
			await tick();
			flush();
			expect(table.atoms.pagination.get().pageIndex).toBe(1);
		} finally {
			dispose();
		}
	});
});

describe("controlled state in a rendered table", () => {
	test("signal-controlled sorting drives the DOM and the change handler", () => {
		const [sorting, setSorting] = createSignal<SortingState>([]);

		function Table() {
			const table = newTable({
				state: {
					get sorting() {
						return sorting();
					},
				},
				onSortingChange: setSorting,
			});
			return (
				<ul>
					<For each={table.getRowModel().rows}>{(row) => <li>{row.original.name}</li>}</For>
					<button onClick={() => table.getColumn("age")!.toggleSorting(false)}>Sort age</button>
				</ul>
			);
		}

		render(() => <Table />);
		const names = () => screen.getAllByRole("listitem").map((li) => li.textContent);

		expect(names()).toEqual(["Ada", "Grace", "Linus", "Margaret", "Ken"]);

		fireEvent.click(screen.getByRole("button", { name: "Sort age" }));
		expect(sorting()).toEqual([{ id: "age", desc: false }]);
		expect(names()).toEqual(["Margaret", "Ada", "Linus", "Ken", "Grace"]);

		setSorting([{ id: "name", desc: true }]);
		flush();
		expect(names()).toEqual(["Margaret", "Linus", "Ken", "Grace", "Ada"]);
	});

	test("grouped rows render aggregated cells through FlexRender", () => {
		function Table() {
			const table = newTable({ initialState: { grouping: ["team"] } });
			return (
				<table>
					<tbody>
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
						</For>
					</tbody>
				</table>
			);
		}

		render(() => <Table />);
		const rows = screen.getAllByRole("row").map((tr) => [...tr.children].map((td) => td.textContent));

		expect(rows).toEqual([
			/* The grouping column's own cell is "grouped", which renders `cell`, not `aggregatedCell`. */
			["core", "", "avg 45"],
			["compiler", "", "avg 82.5"],
			["apollo", "", "avg 33"],
		]);
	});
});
