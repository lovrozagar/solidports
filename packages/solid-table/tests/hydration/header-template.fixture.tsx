import { createMemo, For } from "solid-js";
import { createTable, FlexRender, stockFeatures } from "../../src/index.ts";

/* A header template that is a component (it owns a memo), beside a plain string header. */
function Probe() {
	const label = createMemo(() => "probe");
	return <span data-probe="">{label()}</span>;
}

export function HeaderTemplateFixture() {
	const table = createTable({
		columns: [
			{ header: () => <Probe />, id: "probe" },
			{ accessorKey: "name", header: "Name" },
		],
		data: [{ name: "Ada" }],
		features: stockFeatures,
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
