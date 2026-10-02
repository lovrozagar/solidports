import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { For, createSignal } from "solid-js";
import { createPaginatedRowModel, createSortedRowModel, sortFns, stockFeatures } from "@tanstack/table-core";
import { FlexRender } from "../src/FlexRender";
import { createTable } from "../src/createTable";
import type { ColumnDef, SortingState } from "@tanstack/table-core";

afterEach(() => cleanup());

type Person = { id: string; name: string; age: number };

const features = {
	...stockFeatures,
	paginatedRowModel: createPaginatedRowModel(),
	sortFns,
	sortedRowModel: createSortedRowModel(),
};

const people: Array<Person> = [
	{ id: "1", name: "Ada", age: 36 },
	{ id: "2", name: "Grace", age: 85 },
	{ id: "3", name: "Linus", age: 54 },
	{ id: "4", name: "Margaret", age: 33 },
];

const columns: Array<ColumnDef<typeof features, Person>> = [
	{
		id: "select",
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
	{ id: "name", accessorKey: "name", header: "Name", cell: (info) => info.getValue() },
	{ id: "age", accessorKey: "age", header: "Age", cell: (info) => `${info.getValue()}y` },
];

function PeopleTable(props: {
	data: Array<Person>;
	sorting?: SortingState;
	onSortingChange?: (s: SortingState) => void;
}) {
	const table = createTable({
		features,
		columns,
		get data() {
			return props.data;
		},
		getRowId: (row) => row.id,
		initialState: { pagination: { pageIndex: 0, pageSize: 3 } },
	});

	return (
		<>
			<table>
				<thead>
					<For each={table.getHeaderGroups()}>
						{(headerGroup) => (
							<tr>
								<For each={headerGroup.headers}>
									{(header) => (
										<th onClick={(e) => header.column.getToggleSortingHandler()?.(e)}>
											<FlexRender header={header} />
											{header.column.getIsSorted() === "asc"
												? " ▲"
												: header.column.getIsSorted() === "desc"
													? " ▼"
													: ""}
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
			<output aria-label="selected">{Object.keys(table.atoms.rowSelection.get()).sort().join(",")}</output>
			<output aria-label="page">{`${table.atoms.pagination.get().pageIndex + 1}/${table.getPageCount()}`}</output>
			<button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
				Next
			</button>
		</>
	);
}

const bodyRows = () =>
	within(screen.getAllByRole("rowgroup")[1]!)
		.queryAllByRole("row")
		.map((row) =>
			within(row)
				.getAllByRole("cell")
				.slice(1)
				.map((cell) => cell.textContent),
		);

describe("full table rendering", () => {
	test("renders headers, cells, and the first page", () => {
		render(() => <PeopleTable data={people} />);

		expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["", "Name", "Age"]);
		expect(bodyRows()).toEqual([
			["Ada", "36y"],
			["Grace", "85y"],
			["Linus", "54y"],
		]);
		expect(screen.getByRole("status", { name: "page" }).textContent).toBe("1/2");
	});

	test("clicking a header cycles sorting and re-renders rows", () => {
		render(() => <PeopleTable data={people} />);
		const ageHeader = screen.getByRole("columnheader", { name: /Age/ });

		/* TanStack sorts numeric columns descending first. */
		fireEvent.click(ageHeader);
		expect(ageHeader.textContent).toBe("Age ▼");
		expect(bodyRows()).toEqual([
			["Grace", "85y"],
			["Linus", "54y"],
			["Ada", "36y"],
		]);

		fireEvent.click(ageHeader);
		expect(ageHeader.textContent).toBe("Age ▲");
		expect(bodyRows()[0]).toEqual(["Margaret", "33y"]);
	});

	test("checkboxes in cell templates stay reactive", () => {
		render(() => <PeopleTable data={people} />);
		const ada = screen.getByRole("checkbox", { name: "Select Ada" }) as HTMLInputElement;

		fireEvent.click(ada);
		expect(ada.checked).toBe(true);
		expect(screen.getByRole("status", { name: "selected" }).textContent).toBe("1");

		fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
		expect(screen.getByRole("status", { name: "selected" }).textContent).toBe("1,2,3,4");
		expect((screen.getByRole("checkbox", { name: "Select Grace" }) as HTMLInputElement).checked).toBe(true);
	});

	test("pagination moves to the next page and disables at the end", () => {
		render(() => <PeopleTable data={people} />);
		const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;

		fireEvent.click(next);
		expect(bodyRows()).toEqual([["Margaret", "33y"]]);
		expect(screen.getByRole("status", { name: "page" }).textContent).toBe("2/2");
		expect(next.disabled).toBe(true);
	});

	test("reactive data updates rows while keeping selection by row id", () => {
		const [data, setData] = createSignal(people);
		render(() => (
			<>
				<PeopleTable data={data()} />
				<button onClick={() => setData((prev) => prev.map((p) => (p.id === "1" ? { ...p, name: "Ada L." } : p)))}>
					Rename
				</button>
			</>
		));

		fireEvent.click(screen.getByRole("checkbox", { name: "Select Ada" }));
		fireEvent.click(screen.getByRole("button", { name: "Rename" }));

		expect(bodyRows()[0]).toEqual(["Ada L.", "36y"]);
		expect((screen.getByRole("checkbox", { name: "Select Ada L." }) as HTMLInputElement).checked).toBe(true);
	});
});
