import { describe, expect, test, vi } from "vitest";
import { createEffect, createMemo, createRoot, createSignal, flush, getOwner } from "solid-js";
import { createAtom } from "@tanstack/store";
import { stockFeatures } from "@tanstack/table-core";
import { createTable } from "../src/createTable";
import { solidReactivity } from "../src/reactivity";
import { createTestRoot } from "./helpers";
import type { ColumnDef, RowSelectionState } from "@tanstack/table-core";

describe("solidReactivity", () => {
	test("readonly atoms update when wrapped external TanStack Store atoms update", () => {
		createRoot((dispose) => {
			const reactivity = solidReactivity(getOwner());
			const external = createAtom(1);
			const wrapped = reactivity.createWritableAtom(external.get(), { debugName: "wrapped" });
			reactivity.addSubscription(external.subscribe((value) => wrapped.set(value)));
			const doubled = reactivity.createReadonlyAtom(() => wrapped.get() * 2, { debugName: "doubled" });

			expect(doubled.get()).toBe(2);

			external.set(2);
			flush();

			expect(doubled.get()).toBe(4);
			dispose();
		});
	});

	test("readonly atoms preserve dependency tracking through .get()", () => {
		createRoot((dispose) => {
			const reactivity = solidReactivity(getOwner());
			const base = reactivity.createWritableAtom(1);
			const slice = reactivity.createReadonlyAtom(() => base.get(), { debugName: "slice" });
			const store = reactivity.createReadonlyAtom(() => ({ slice: slice.get() }), { debugName: "store" });

			expect(store.get()).toEqual({ slice: 1 });

			base.set(2);
			flush();

			expect(store.get()).toEqual({ slice: 2 });
			dispose();
		});
	});

	test("writable atoms accept values and updaters, and updaters chain before a flush", () => {
		createRoot((dispose) => {
			const reactivity = solidReactivity(getOwner());
			const count = reactivity.createWritableAtom(0);

			count.set(5);
			count.set((prev) => prev + 1);
			count.set((prev) => prev + 1);
			flush();

			expect(count.get()).toBe(7);
			dispose();
		});
	});

	test("subscribe emits later changes only, accepts both observer shapes, and unsubscribes", () => {
		createRoot((dispose) => {
			const reactivity = solidReactivity(getOwner());
			const count = reactivity.createWritableAtom(0);
			const fnObserver = vi.fn<(value: number) => void>();
			const objObserver = vi.fn<(value: number) => void>();
			const fnSub = count.subscribe(fnObserver);
			count.subscribe({ next: objObserver });
			flush();

			expect(fnObserver).not.toHaveBeenCalled();

			count.set(1);
			flush();
			fnSub.unsubscribe();
			count.set(2);
			flush();

			expect(fnObserver.mock.calls).toEqual([[1]]);
			expect(objObserver.mock.calls).toEqual([[1], [2]]);
			dispose();
		});
	});
});

describe("Solid table reactivity integration", () => {
	type Data = { id: string; title: string };
	const initialData: Array<Data> = [{ id: "1", title: "Title" }];
	const columns: Array<ColumnDef<typeof stockFeatures, Data>> = [
		{ id: "id", header: "Id", accessorKey: "id", cell: (context) => context.getValue() },
		{ id: "title", header: "Title", accessorKey: "title", cell: (context) => context.getValue() },
	];

	function createTestTable(data: () => Array<Data> = () => initialData) {
		return createTable({
			features: { ...stockFeatures },
			columns,
			get data() {
				return data();
			},
			getRowId: (row) => row.id,
		});
	}

	test("effects respond only to the table inputs they read", () => {
		const { dispose, value } = createTestRoot(() => {
			const [data, setData] = createSignal<Array<Data>>(initialData);
			const table = createTestTable(data);
			const captors = {
				isSelectedRow1: vi.fn<(value: boolean) => void>(),
				titleValue: vi.fn<(value: unknown) => void>(),
				columnIsVisible: vi.fn<(value: boolean) => void>(),
			};
			const row = createMemo(() => table.getRowModel().rows[0]!);
			const titleCell = createMemo(() => row().getAllCells()[1]!);

			createEffect(() => row().getIsSelected(), captors.isSelectedRow1);
			createEffect(() => titleCell().getValue(), captors.titleValue);
			createEffect(() => table.getColumn("id")!.getIsVisible(), captors.columnIsVisible);

			return { captors, setData, table };
		});
		const { captors, setData, table } = value;
		const clear = () => Object.values(captors).forEach((captor) => captor.mockClear());

		try {
			expect(captors.isSelectedRow1.mock.calls.map(([v]) => v)).toEqual([false]);
			expect(captors.titleValue.mock.calls.map(([v]) => v)).toEqual(["Title"]);
			expect(captors.columnIsVisible.mock.calls.map(([v]) => v)).toEqual([true]);

			clear();
			table.getRow("1").toggleSelected(true);
			flush();

			expect(captors.isSelectedRow1.mock.calls.map(([v]) => v)).toEqual([true]);
			expect(captors.titleValue).not.toHaveBeenCalled();
			expect(captors.columnIsVisible).not.toHaveBeenCalled();

			clear();
			setData([{ id: "1", title: "Title 3" }]);
			flush();

			expect(captors.titleValue.mock.lastCall?.[0]).toBe("Title 3");

			clear();
			table.getColumn("id")!.toggleVisibility(false);
			flush();

			expect(captors.columnIsVisible.mock.calls.map(([v]) => v)).toEqual([false]);
			expect(captors.isSelectedRow1).not.toHaveBeenCalled();
			expect(captors.titleValue).not.toHaveBeenCalled();
		} finally {
			dispose();
		}
	});

	test("table store can be subscribed to", () => {
		const { dispose, value } = createTestRoot(() => {
			const table = createTestTable();
			const tableStateCaptor = vi.fn<(state: ReturnType<typeof table.store.get>) => void>();
			table.store.subscribe(() => tableStateCaptor(table.store.get()));
			return { table, tableStateCaptor };
		});
		const { table, tableStateCaptor } = value;

		try {
			table.toggleAllRowsSelected(true);
			flush();

			expect(tableStateCaptor.mock.calls.map(([state]) => state.rowSelection)).toEqual([{ 1: true }]);
		} finally {
			dispose();
		}
	});

	test("table state reacts to every flushed external signal state update", () => {
		const { dispose, value } = createTestRoot(() => {
			const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
			const table = createTable({
				data: initialData,
				features: { ...stockFeatures },
				columns,
				getRowId: (row) => row.id,
				state: {
					get rowSelection() {
						return rowSelection();
					},
				},
			});
			const tableStateCaptor = vi.fn<(value: RowSelectionState) => void>();

			createEffect(() => table.atoms.rowSelection.get(), tableStateCaptor);

			return { setRowSelection, tableStateCaptor };
		});
		const { setRowSelection, tableStateCaptor } = value;

		try {
			setRowSelection({ 1: true });
			flush();
			setRowSelection({ 1: true, 2: true });
			flush();
			setRowSelection({ 2: true });
			flush();

			expect(tableStateCaptor.mock.calls.map(([v]) => v)).toEqual([{}, { 1: true }, { 1: true, 2: true }, { 2: true }]);
		} finally {
			dispose();
		}
	});

	test("unflushed writes coalesce into one update", () => {
		const { dispose, value } = createTestRoot(() => {
			const table = createTable({
				data: initialData,
				features: { ...stockFeatures },
				columns,
				getRowId: (row) => row.id,
				initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
			});
			const pageSizeCaptor = vi.fn<(value: number) => void>();
			createEffect(() => table.atoms.pagination.get().pageSize, pageSizeCaptor);
			return { pageSizeCaptor, table };
		});
		const { pageSizeCaptor, table } = value;

		try {
			table.setPageSize(50);
			table.setPageSize(100);
			flush();

			expect(pageSizeCaptor.mock.calls.map(([v]) => v)).toEqual([20, 100]);
		} finally {
			dispose();
		}
	});

	test("table state reacts to internal table state updates", () => {
		const { dispose, value } = createTestRoot(() => {
			const table = createTable({
				data: initialData,
				features: { ...stockFeatures },
				columns,
				getRowId: (row) => row.id,
				initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
			});
			const pageSizeCaptor = vi.fn<(value: number) => void>();
			const storePageSizeCaptor = vi.fn<(value: number) => void>();

			createEffect(() => table.atoms.pagination.get().pageSize, pageSizeCaptor);
			createEffect(() => table.store.get().pagination.pageSize, storePageSizeCaptor);

			return { pageSizeCaptor, storePageSizeCaptor, table };
		});
		const { pageSizeCaptor, storePageSizeCaptor, table } = value;

		try {
			table.setPageSize(50);
			flush();
			table.setPageSize(100);
			flush();

			expect(pageSizeCaptor.mock.calls.map(([v]) => v)).toEqual([20, 50, 100]);
			expect(storePageSizeCaptor.mock.calls.map(([v]) => v)).toEqual([20, 50, 100]);
		} finally {
			dispose();
		}
	});

	test("table state property reads only track the accessed slice", () => {
		const { dispose, value } = createTestRoot(() => {
			const table = createTable({
				data: initialData,
				features: { ...stockFeatures },
				columns,
				getRowId: (row) => row.id,
				initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
			});
			const pageSizeCaptor = vi.fn<(value: number) => void>();
			const stateJsonCaptor = vi.fn<(value: string) => void>();

			createEffect(() => table.atoms.pagination.get().pageSize, pageSizeCaptor);
			createEffect(() => JSON.stringify(table.store.get()), stateJsonCaptor);

			return { pageSizeCaptor, stateJsonCaptor, table };
		});
		const { pageSizeCaptor, stateJsonCaptor, table } = value;

		try {
			table.toggleAllRowsSelected(true);
			flush();

			expect(pageSizeCaptor.mock.calls.map(([v]) => v)).toEqual([20]);
			expect(stateJsonCaptor).toHaveBeenCalledTimes(2);
			expect(JSON.parse(stateJsonCaptor.mock.calls.at(-1)![0]).rowSelection).toEqual({ 1: true });
		} finally {
			dispose();
		}
	});
});
