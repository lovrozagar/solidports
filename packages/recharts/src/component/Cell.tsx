import type { JSX } from '@solidjs/web';
import { useCellsRegistry } from "../context/CellsContext"

export interface Props {
	/** The fill color. */
	fill?: string
	/** The stroke color. */
	stroke?: string
	[key: string]: unknown
}

/**
 * Cell component used to define colors and styles of chart elements.
 *
 * This component is now deprecated and will be removed in Recharts 4.0.
 *
 * Please use the `shape` prop or `content` prop on the respective chart components
 * to customize the rendering of chart elements instead of using `Cell`.
 *
 * @see {@link https://recharts.github.io/en-US/guide/cell/ Guide: Migrate from Cell component to shape prop}
 *
 * @deprecated
 * @consumes CellReader
 */
export const Cell = (props: Props): JSX.Element | null => {
	/* Solid cannot introspect JSX (no findAllByType parity). Cell instead opts
	 * into the closest CellsRegistry — Bar/Pie/Scatter/... mount one above their
	 * children scope. Outside any registry the call is a no-op so standalone
	 * usage (e.g. unit tests) keeps the empty-DOM contract. */
	const registry = useCellsRegistry()
	if (registry) {
		registry.register(() => ({ ...props }))
	}
	return null
}

Cell.displayName = "Cell"
