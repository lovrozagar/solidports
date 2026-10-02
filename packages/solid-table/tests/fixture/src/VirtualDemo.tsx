import { For, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from "@tanstack/virtual-core";
import { FlexRender, createSortedRowModel, createTable, sortFns, stockFeatures } from "@solidports/solid-table";
import { makePeople } from "./data";
import type { ColumnDef } from "@solidports/solid-table";
import type { Person } from "./data";

const ROW_HEIGHT = 30;
const features = { ...stockFeatures, sortFns, sortedRowModel: createSortedRowModel() };
const columns: Array<ColumnDef<typeof features, Person>> = [
	{ id: "name", accessorKey: "name", header: "Name", cell: (info) => String(info.getValue()) },
	{ id: "age", accessorKey: "age", header: "Age", cell: (info) => String(info.getValue()) },
];

/* @tanstack/solid-virtual is Solid 1 only, so drive virtual-core directly. */
export function VirtualDemo() {
	const table = createTable({ features, columns, data: makePeople(10_000), getRowId: (row) => row.id });
	const rows = createMemo(() => table.getRowModel().rows);

	let scrollEl!: HTMLDivElement;
	const [version, setVersion] = createSignal(0, { ownedWrite: true });
	const virtualizer = new Virtualizer<HTMLDivElement, Element>({
		count: 0,
		getScrollElement: () => scrollEl,
		estimateSize: () => ROW_HEIGHT,
		overscan: 5,
		scrollToFn: elementScroll,
		observeElementRect,
		observeElementOffset,
		onChange: () => setVersion((v) => v + 1),
	});

	createEffect(
		() => rows().length,
		(count) => {
			virtualizer.setOptions({ ...virtualizer.options, count });
			virtualizer._willUpdate();
			setVersion((v) => v + 1);
		},
	);
	onSettled(() => {
		const cleanup = virtualizer._didMount();
		virtualizer._willUpdate();
		return cleanup;
	});

	const items = createMemo(() => {
		version();
		return virtualizer.getVirtualItems();
	});

	return (
		<section>
			<button onClick={() => table.getColumn("age")!.toggleSorting(false)}>Sort by age</button>
			<output aria-label="Total rows">{rows().length}</output>
			<div ref={scrollEl} data-testid="scroller" style={{ height: "300px", overflow: "auto" }}>
				<div style={{ height: `${(version(), virtualizer.getTotalSize())}px`, position: "relative" }}>
					<For each={items()}>
						{(item) => (
							<div
								data-row={rows()[item.index]!.id}
								style={{
									position: "absolute",
									top: "0",
									height: `${ROW_HEIGHT}px`,
									transform: `translateY(${item.start}px)`,
								}}
							>
								<For each={rows()[item.index]!.getVisibleCells()}>
									{(cell) => (
										<span style={{ display: "inline-block", width: "120px" }}>
											<FlexRender cell={cell} />
										</span>
									)}
								</For>
							</div>
						)}
					</For>
				</div>
			</div>
		</section>
	);
}
