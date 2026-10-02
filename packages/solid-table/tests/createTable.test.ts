import { describe, expect, test, vi } from "vitest";
import { createEffect, createSignal, flush } from "solid-js";
import {
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFns,
	sortFns,
	stockFeatures,
} from "@tanstack/table-core";
import { createTable } from "../src/createTable";
import { createTestRoot } from "./helpers";
import type { ColumnDef, PaginationState } from "@tanstack/table-core";

describe("createTable", () => {
	type Data = { id: string; title: string };
	const paginatedFeatures = {
		...stockFeatures,
		filterFns,
		filteredRowModel: createFilteredRowModel(),
		paginatedRowModel: createPaginatedRowModel(),
		sortFns,
		sortedRowModel: createSortedRowModel(),
	};
	const columns: Array<ColumnDef<typeof paginatedFeatures, Data>> = [
		{ id: "id", header: "Id", accessorKey: "id", cell: (context) => context.getValue() },
		{ id: "title", header: "Title", accessorKey: "title", cell: (context) => context.getValue() },
	];
	const data = Array.from({ length: 10 }, (_, index) => ({ id: String(index), title: `Title ${index}` }));

	test("row models react to controlled pagination changes", () => {
		const rowIdsCaptor = vi.fn<(ids: Array<string>) => void>();
		const { dispose, value: table } = createTestRoot(() => {
			const [pagination, setPagination] = createSignal<PaginationState>({ pageSize: 5, pageIndex: 0 });
			const table = createTable({
				data,
				columns,
				features: paginatedFeatures,
				getRowId: (row) => row.id,
				state: {
					get pagination() {
						return pagination();
					},
				},
				onPaginationChange: setPagination,
			});
			createEffect(() => table.getRowModel().rows.map((row) => row.id), rowIdsCaptor);
			return table;
		});

		try {
			expect(rowIdsCaptor.mock.calls.map(([ids]) => ids)).toEqual([["0", "1", "2", "3", "4"]]);

			table.setPageSize(3);
			flush();

			expect(rowIdsCaptor.mock.calls.map(([ids]) => ids)).toEqual([
				["0", "1", "2", "3", "4"],
				["0", "1", "2"],
			]);
		} finally {
			dispose();
		}
	});

	test("chained updaters compose before a flush in controlled mode", () => {
		const { dispose, value: table } = createTestRoot(() => {
			const [pagination, setPagination] = createSignal<PaginationState>({ pageSize: 2, pageIndex: 0 });
			return createTable({
				data,
				columns,
				features: paginatedFeatures,
				getRowId: (row) => row.id,
				state: {
					get pagination() {
						return pagination();
					},
				},
				onPaginationChange: setPagination,
			});
		});

		try {
			table.nextPage();
			table.nextPage();
			flush();

			expect(table.atoms.pagination.get().pageIndex).toBe(2);
			expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["4", "5"]);
		} finally {
			dispose();
		}
	});

	test("sorting, filtering, and pagination compose with internal state", () => {
		const { dispose, value: table } = createTestRoot(() =>
			createTable({
				data,
				columns,
				features: paginatedFeatures,
				getRowId: (row) => row.id,
				initialState: { pagination: { pageIndex: 0, pageSize: 3 } },
			}),
		);

		try {
			table.setSorting([{ id: "id", desc: true }]);
			flush();
			expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["9", "8", "7"]);

			table.getColumn("title")!.setFilterValue("Title 1");
			flush();
			expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["1"]);

			table.resetColumnFilters();
			table.nextPage();
			flush();
			expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["6", "5", "4"]);
		} finally {
			dispose();
		}
	});
});
