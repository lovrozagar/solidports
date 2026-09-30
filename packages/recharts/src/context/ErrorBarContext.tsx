import {
	createContext,
	createRenderEffect,
	on,
	onCleanup,
	useContext,
	type Accessor,
	type JSX,
} from "solid-js"
import { produce } from "solid-js/store"
import type { ErrorBarsState } from "../state/errorBarSlice"
import type { AxisId } from "../state/cartesianAxisSlice"
import type {
	ErrorBarDataItem,
	ErrorBarDataPointFormatter,
	ErrorBarDirection,
} from "../cartesian/ErrorBar"
import type { ErrorBarsSettings } from "../state/errorBarSlice"
import { useChartStore } from "../state/RechartsStoreContext"
import { useGraphicalItemId } from "./RegisterGraphicalItemId"
import type { BarRectangleItem } from "../cartesian/Bar"
import type { LinePointItem } from "../cartesian/Line"
import type { ScatterPointItem } from "../cartesian/Scatter"
import type { DataKey } from "../util/types"

type ErrorBarItemType = BarRectangleItem | LinePointItem | ScatterPointItem

/**
 * A type-erased formatter that the context stores.
 * The entry parameter uses the union so consumers can call it with any item type.
 */
type ErasedErrorBarFormatter = (
	entry: ErrorBarItemType,
	dataKey: DataKey<ErrorBarItemType, number[] | number>,
	direction: ErrorBarDirection,
) => ErrorBarDataItem

type ErrorBarContextType = {
	data: ReadonlyArray<unknown> | undefined
	dataPointFormatter: ErasedErrorBarFormatter
	errorBarOffset: number
	xAxisId: AxisId
	yAxisId: AxisId
}

const initialContextState: ErrorBarContextType = {
	data: [],
	dataPointFormatter: () => ({ value: 0, x: 0, y: 0 }),
	errorBarOffset: 0,
	xAxisId: "xAxis-0",
	yAxisId: "yAxis-0",
}

/* Provider value is an Accessor (GOTCHA-005-A) — Solid context returns a static
   read at consume time, so wrapping the value in `() => ...` lets ErrorBarImpl
   re-evaluate `ctx().data` reactively as `rects()` populates. */
const initialContextAccessor: Accessor<ErrorBarContextType> = () => initialContextState

const ErrorBarContext = createContext<Accessor<ErrorBarContextType>>(initialContextAccessor)

/**
 * Wraps a specifically-typed formatter into the erased context formatter type.
 * This is safe because at runtime, each provider only passes entries
 * of the correct type for its formatter.
 */
function eraseFormatter<T extends ErrorBarItemType>(
	formatter: ErrorBarDataPointFormatter<T>,
): ErasedErrorBarFormatter {
	return (entry, dataKey, direction) =>
		formatter(entry as T, dataKey as DataKey<T, number[] | number>, direction)
}

type SetErrorBarContextProps<T extends ErrorBarItemType> = {
	data: ReadonlyArray<unknown> | undefined
	dataPointFormatter: ErrorBarDataPointFormatter<T>
	errorBarOffset: number
	xAxisId: AxisId
	yAxisId: AxisId
	children: JSX.Element
}

export function SetErrorBarContext<T extends ErrorBarItemType>(props: SetErrorBarContextProps<T>) {
	/* Pass the Accessor itself (not its value) so consumers re-evaluate as
	   `props.data` populates downstream — Solid's createContext returns a single
	   read at useContext time, the Accessor wraps the live value. */
	const value: Accessor<ErrorBarContextType> = () => ({
		data: props.data,
		dataPointFormatter: eraseFormatter(props.dataPointFormatter),
		errorBarOffset: props.errorBarOffset,
		xAxisId: props.xAxisId,
		yAxisId: props.yAxisId,
	})
	return <ErrorBarContext.Provider value={value}>{props.children}</ErrorBarContext.Provider>
}

export const useErrorBarContext = (): Accessor<ErrorBarContextType> => useContext(ErrorBarContext)

export function ReportErrorBarSettings(props: ErrorBarsSettings): null {
	const ctx = useChartStore()
	const graphicalItemId = useGraphicalItemId()
	let prevProps: ErrorBarsSettings | null = null

	/* `on(...)` runs the callback untracked — setStore reads inside the dispatch
	   never re-subscribe this scope (would otherwise loop on state.errorBars[id]).
	   createRenderEffect runs synchronously during parent render so the slice is
	   populated before any selector that reads it. */
	createRenderEffect(
		on(
			/* eslint-disable-next-line solid/reactivity -- accessors passed to Solid's `on()` ARE tracked; linter can't trace through `on()` helper */
			[() => props.dataKey, () => props.direction] as const,
			([dataKey, direction]) => {
				if (graphicalItemId == null) {
					return
				}
				const next: ErrorBarsSettings = { dataKey, direction }
				if (prevProps === null) {
					ctx?.setStore(
						"errorBars",
						produce((errorBars: ErrorBarsState) => {
							const list = errorBars[graphicalItemId] ?? []
							errorBars[graphicalItemId] = [...list, next]
						}),
					)
				} else {
					const prev = prevProps
					ctx?.setStore(
						"errorBars",
						produce((errorBars: ErrorBarsState) => {
							const list = errorBars[graphicalItemId]
							if (list == null) return
							errorBars[graphicalItemId] = list.map((e) => (e === prev ? next : e))
						}),
					)
				}
				prevProps = next
			},
		),
	)

	onCleanup(() => {
		if (prevProps != null && graphicalItemId != null) {
			const toRemove = prevProps
			ctx?.setStore(
				"errorBars",
				produce((errorBars: ErrorBarsState) => {
					const list = errorBars[graphicalItemId]
					if (list == null) return
					errorBars[graphicalItemId] = list.filter(
						(e: ErrorBarsSettings) => e !== toRemove,
					)
				}),
			)
			prevProps = null
		}
	})

	return null
}
