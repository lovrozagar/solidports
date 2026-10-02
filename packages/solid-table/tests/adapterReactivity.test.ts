import { describe, expect, test, vi } from "vitest";
import { createEffect, createMemo, createSignal, flush } from "solid-js";
import { createAtom } from "@tanstack/store";
import { stockFeatures } from "@tanstack/table-core";
import { createTable } from "../src/createTable";
import { createTestRoot } from "./helpers";
import type { ColumnDef, RowSelectionState } from "@tanstack/table-core";

describe("Solid adapter lifecycle and option ownership", () => {
	type Data = { id: string; title: string };
	const idColumn: ColumnDef<typeof stockFeatures, Data> = { id: "id", accessorKey: "id" };
	const titleColumn: ColumnDef<typeof stockFeatures, Data> = { id: "title", accessorKey: "title" };
	const twoRows: Array<Data> = [
		{ id: "1", title: "One" },
		{ id: "2", title: "Two" },
	];
	const values = (captor: { mock: { calls: Array<Array<unknown>> } }) => captor.mock.calls.map(([v]) => v);

	test("disposing the owner unsubscribes external atoms and stops reactions", () => {
		const sourceAtom = createAtom<RowSelectionState>({});
		const subscribeSpy = vi.spyOn(sourceAtom, "subscribe");

		const { dispose, value } = createTestRoot(() => {
			const table = createTable({
				data: [{ id: "1", title: "Title" }],
				columns: [idColumn, titleColumn],
				features: stockFeatures,
				getRowId: (row) => row.id,
				atoms: { rowSelection: sourceAtom },
			});
			const stateCaptor = vi.fn<(state: RowSelectionState) => void>();
			createEffect(() => table.atoms.rowSelection.get(), stateCaptor);
			return { stateCaptor, table };
		});
		const { stateCaptor, table } = value;

		expect(subscribeSpy).toHaveBeenCalledTimes(1);

		const subscription = subscribeSpy.mock.results[0]!.value;
		const unsubscribeSpy = vi.spyOn(subscription, "unsubscribe");

		sourceAtom.set({ 1: true });
		flush();
		expect(values(stateCaptor)).toEqual([{}, { 1: true }]);

		dispose();

		expect(unsubscribeSpy).toHaveBeenCalledTimes(1);

		sourceAtom.set({ 2: true });
		flush();

		expect(sourceAtom.get()).toEqual({ 2: true });
		expect(table.atoms.rowSelection.get()).toEqual({ 1: true });
		expect(values(stateCaptor)).toEqual([{}, { 1: true }]);

		table.setRowSelection({ 3: true });
		flush();

		expect(sourceAtom.get()).toEqual({ 2: true });
	});

	test("controlled state can release and reacquire ownership without losing the latest value", () => {
		const { dispose, value } = createTestRoot(() => {
			const [controlledState, setControlledState] = createSignal<{ rowSelection?: RowSelectionState }>({
				rowSelection: { 1: true },
			});
			const table = createTable({
				data: twoRows,
				columns: [idColumn, titleColumn],
				features: stockFeatures,
				getRowId: (row) => row.id,
				get state() {
					return controlledState();
				},
			});
			const stateCaptor = vi.fn<(state: RowSelectionState) => void>();
			createEffect(() => table.atoms.rowSelection.get(), stateCaptor);
			return { setControlledState, stateCaptor, table };
		});
		const { setControlledState, stateCaptor, table } = value;
		const step = (fn: () => void) => {
			fn();
			flush();
		};

		try {
			expect(table.atoms.rowSelection.get()).toEqual({ 1: true });

			step(() => setControlledState({}));
			expect(table.options.state).toEqual({});
			expect(table.atoms.rowSelection.get()).toEqual({ 1: true });

			step(() => table.setRowSelection({ 2: true }));
			expect(table.atoms.rowSelection.get()).toEqual({ 2: true });

			step(() => setControlledState({ rowSelection: { 1: true, 2: true } }));
			expect(table.atoms.rowSelection.get()).toEqual({ 1: true, 2: true });

			step(() => table.setRowSelection({}));
			expect(table.atoms.rowSelection.get()).toEqual({ 1: true, 2: true });

			step(() => setControlledState({}));
			expect(table.atoms.rowSelection.get()).toEqual({});
			expect(values(stateCaptor)).toEqual([{ 1: true }, { 2: true }, { 1: true, 2: true }, {}]);
		} finally {
			dispose();
		}
	});

	test("an external atom takes precedence over controlled state and receives table writes", () => {
		const externalAtom = createAtom<RowSelectionState>({ 2: true });
		const { dispose, value } = createTestRoot(() => {
			const [controlledSelection, setControlledSelection] = createSignal<RowSelectionState>({ 1: true });
			const table = createTable({
				data: twoRows,
				columns: [idColumn, titleColumn],
				features: stockFeatures,
				getRowId: (row) => row.id,
				state: {
					get rowSelection() {
						return controlledSelection();
					},
				},
				atoms: { rowSelection: externalAtom },
			});
			const stateCaptor = vi.fn<(state: RowSelectionState) => void>();
			const isSelectedCaptor = vi.fn<(selected: boolean) => void>();
			const isSelected = createMemo(() => table.getRow("1").getIsSelected());
			createEffect(() => table.atoms.rowSelection.get(), stateCaptor);
			createEffect(isSelected, isSelectedCaptor);
			return { isSelectedCaptor, setControlledSelection, stateCaptor, table };
		});
		const { isSelectedCaptor, setControlledSelection, stateCaptor, table } = value;

		try {
			expect(table.atoms.rowSelection.get()).toEqual({ 2: true });

			setControlledSelection({ 1: true, 2: true });
			flush();
			expect(table.atoms.rowSelection.get()).toEqual({ 2: true });

			externalAtom.set({ 1: true });
			flush();
			expect(table.atoms.rowSelection.get()).toEqual({ 1: true });

			table.setRowSelection({ 2: true });
			flush();
			expect(externalAtom.get()).toEqual({ 2: true });
			expect(table.atoms.rowSelection.get()).toEqual({ 2: true });
			expect(values(stateCaptor)).toEqual([{ 2: true }, { 1: true }, { 2: true }]);
			expect(values(isSelectedCaptor)).toEqual([false, true, false]);
		} finally {
			dispose();
		}
	});

	test("option updates before a flush publish only the final data, columns, and option values", () => {
		const { dispose, value } = createTestRoot(() => {
			const [data, setData] = createSignal<Array<Data>>([{ id: "1", title: "Initial" }]);
			const [columns, setColumns] = createSignal<Array<ColumnDef<typeof stockFeatures, Data>>>([idColumn]);
			const [enableRowSelection, setEnableRowSelection] = createSignal(true);
			const table = createTable({
				features: stockFeatures,
				get data() {
					return data();
				},
				get columns() {
					return columns();
				},
				get enableRowSelection() {
					return enableRowSelection();
				},
				getRowId: (row) => row.id,
			});
			const snapshotCaptor =
				vi.fn<(snapshot: { canSelect: boolean; columnIds: Array<string>; values: Array<unknown> }) => void>();

			createEffect(() => {
				const row = table.getRowModel().rows[0]!;
				return {
					canSelect: row.getCanSelect(),
					columnIds: table.getAllLeafColumns().map((column) => column.id),
					values: row.getAllCells().map((cell) => cell.getValue()),
				};
			}, snapshotCaptor);

			return { setColumns, setData, setEnableRowSelection, snapshotCaptor };
		});
		const { setColumns, setData, setEnableRowSelection, snapshotCaptor } = value;

		try {
			setData([{ id: "2", title: "Intermediate" }]);
			setColumns([idColumn, titleColumn]);
			setEnableRowSelection(false);
			setData([{ id: "3", title: "Final" }]);
			setColumns([titleColumn]);
			flush();

			expect(values(snapshotCaptor)).toEqual([
				{ canSelect: true, columnIds: ["id"], values: ["1"] },
				{ canSelect: false, columnIds: ["title"], values: ["Final"] },
			]);
		} finally {
			dispose();
		}
	});

	test("table APIs use the latest signal-backed option callback", () => {
		const firstHandler = vi.fn();
		const secondHandler = vi.fn();
		const { dispose, value } = createTestRoot(() => {
			const [onRowSelectionChange, setOnRowSelectionChange] = createSignal(() => firstHandler);
			const table = createTable({
				data: [{ id: "1", title: "Title" }],
				columns: [idColumn, titleColumn],
				features: stockFeatures,
				getRowId: (row) => row.id,
				get onRowSelectionChange() {
					return onRowSelectionChange();
				},
			});
			return { setOnRowSelectionChange, table };
		});
		const { setOnRowSelectionChange, table } = value;

		try {
			table.toggleAllRowsSelected(true);
			expect(firstHandler).toHaveBeenCalledTimes(1);
			expect(secondHandler).not.toHaveBeenCalled();

			setOnRowSelectionChange(() => secondHandler);
			flush();
			table.toggleAllRowsSelected(false);

			expect(firstHandler).toHaveBeenCalledTimes(1);
			expect(secondHandler).toHaveBeenCalledTimes(1);
		} finally {
			dispose();
		}
	});
});
