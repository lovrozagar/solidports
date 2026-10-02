import { describe, expect, test } from "vitest";
import { For, createSignal } from "solid-js";
import { isServer, renderToString } from "@solidjs/web";
import { createSortedRowModel, sortFns, stockFeatures } from "@tanstack/table-core";
import { FlexRender } from "../../src/FlexRender";
import { createTable } from "../../src/createTable";
import { createTableHook } from "../../src/createTableHook";
import type { ColumnDef, SortingState } from "@tanstack/table-core";

type Person = { id: string; name: string; age: number };
const features = { ...stockFeatures, sortFns, sortedRowModel: createSortedRowModel() };
const data: Array<Person> = [
	{ id: "1", name: "Ada", age: 36 },
	{ id: "2", name: "Grace", age: 85 },
];
const columns: Array<ColumnDef<typeof features, Person>> = [
	{ id: "name", accessorKey: "name", header: "Name", cell: (info) => <b>{String(info.getValue())}</b> },
	{ id: "age", accessorKey: "age", header: () => <i>Age</i>, cell: (info) => String(info.getValue()) },
];

describe("server rendering", () => {
	test("runs on the Solid server build", () => {
		expect(isServer).toBe(true);
	});

	test("renders headers and sorted rows to a string", () => {
		function PeopleTable() {
			const [sorting] = createSignal<SortingState>([{ id: "age", desc: true }]);
			const table = createTable({
				features,
				columns,
				data,
				getRowId: (row) => row.id,
				state: {
					get sorting() {
						return sorting();
					},
				},
			});
			return (
				<table>
					<thead>
						<For each={table.getHeaderGroups()}>
							{(group) => (
								<tr>
									<For each={group.headers}>
										{(header) => (
											<th>
												<FlexRender header={header} />
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

		const html = renderToString(() => <PeopleTable />)
			.replace(/<!--.*?-->/g, "")
			.replace(/ data-hk="[^"]*"/g, "");

		expect(html).toBe(
			"<table><thead><tr><th>Name</th><th><i>Age</i></th></tr></thead>" +
				"<tbody><tr><td><b>Grace</b></td><td>85</td></tr><tr><td><b>Ada</b></td><td>36</td></tr></tbody></table>",
		);
	});

	test("createTableHook components render on the server", () => {
		const hook = createTableHook({ features, getRowId: (row: Person) => row.id });
		const helper = hook.createAppColumnHelper<Person>();
		const hookColumns = helper.columns([
			helper.accessor("name", { header: "Name", footer: "Total", cell: (info) => info.getValue() }),
		]);

		function HookTable() {
			const table = hook.createAppTable({ columns: hookColumns, data });
			return (
				<table.AppTable>
					<For each={table.getRowModel().rows}>
						{(row) => (
							<For each={row.getVisibleCells()}>
								{(cell) => <table.AppCell cell={cell}>{(c) => <span>{<c.FlexRender />}</span>}</table.AppCell>}
							</For>
						)}
					</For>
					<For each={table.getFooterGroups()[0]!.headers}>
						{(header) => <table.AppFooter header={header}>{(h) => <em>{<h.FlexRender />}</em>}</table.AppFooter>}
					</For>
				</table.AppTable>
			);
		}

		const html = renderToString(() => <HookTable />)
			.replace(/<!--.*?-->/g, "")
			.replace(/ data-hk="[^"]*"/g, "");

		expect(html).toBe("<span>Ada</span><span>Grace</span><em>Total</em>");
	});
});
