import { constructTable } from "@tanstack/table-core";
import { getOwner, merge, onCleanup, untrack } from "solid-js";
import { FlexRender } from "./FlexRender";
import { solidReactivity } from "./reactivity";
import type { RowData, Table, TableFeatures, TableOptions } from "@tanstack/table-core";
import type { JSX } from "@solidjs/web";

export type SolidTable<TFeatures extends TableFeatures, TData extends RowData> = Table<TFeatures, TData> & {
	/**
	 * Creates a reactive render boundary. The child function reads the table
	 * atoms it needs, so Solid only tracks those atom reads.
	 */
	Subscribe: (props: { children: (atoms: Table<TFeatures, TData>["atoms"]) => JSX.Element }) => JSX.Element;
	/**
	 * Convenience FlexRender component attached to the table instance for
	 * rendering headers, cells, or footers with custom markup. Mirrors the
	 * `table.FlexRender` API exposed by `createTableHook`'s `createAppTable`.
	 *
	 * @example
	 * <table.FlexRender header={header} />
	 * <table.FlexRender cell={cell} />
	 * <table.FlexRender footer={footer} />
	 */
	FlexRender: typeof FlexRender;
};

/**
 * Creates a Solid table instance backed by Solid signals and memos.
 *
 * Table APIs and atom reads participate in Solid dependency tracking, so
 * computations that read a specific slice can update without invalidating
 * unrelated UI. Use `table.Subscribe` to create atom-tracked render boundaries.
 *
 * State writes follow Solid 2 batching: they become visible to reads after the
 * next microtask or an explicit `flush()`.
 *
 * @example
 * ```tsx
 * const table = createTable({
 *   features,
 *   columns,
 *   data,
 * })
 * ```
 */
export function createTable<TFeatures extends TableFeatures, TData extends RowData>(
	tableOptions: TableOptions<TFeatures, TData>,
): SolidTable<TFeatures, TData> {
	const reactivity = solidReactivity(getOwner(), () => tableOptions.state as Record<string, unknown> | undefined);

	/* Construction reads options and atoms once by design; keep those reads out of the caller's scope. */
	const { table, mergedOptions } = untrack(() => {
		const mergedOptions = merge(tableOptions, {
			features: {
				coreReactivityFeature: reactivity,
				...tableOptions.features,
			},
		}) as TableOptions<TFeatures, TData>;

		const resolvedOptions = merge(
			{
				mergeOptions: (defaultOptions: TableOptions<TFeatures, TData>, options: TableOptions<TFeatures, TData>) =>
					merge(defaultOptions, options),
			},
			mergedOptions,
		) as TableOptions<TFeatures, TData>;

		const table = constructTable(resolvedOptions) as unknown as SolidTable<TFeatures, TData>;

		/* constructTable spreads the options, freezing getter values. Swap in a lazy
		   merge so option getters (data, columns, callbacks, state) stay reactive. */
		table.setOptions((prev) => merge(prev, mergedOptions) as TableOptions<TFeatures, TData>);

		return { table, mergedOptions };
	});

	onCleanup(() => reactivity.unmount?.());

	table.Subscribe = (props) => props.children(table.atoms as Table<TFeatures, TData>["atoms"]);
	table.FlexRender = FlexRender;

	return table;
}
