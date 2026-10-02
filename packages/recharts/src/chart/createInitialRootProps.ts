/* eslint-disable import/no-cycle */
import type { UpdatableChartOptions } from "../state/rootPropsSlice"
import { initialRootPropsState } from "../state/rootPropsSlice"

const rootPropKeys = Object.keys(initialRootPropsState) as ReadonlyArray<keyof UpdatableChartOptions>

/**
 * Seeds `rootProps` at store creation so the first render already sees the chart's options
 * (ReportChartProps keeps them in sync afterwards). Call untracked; reads only option keys,
 * never `children`.
 */
export function createInitialRootProps(
	chartProps: Partial<Record<keyof UpdatableChartOptions, unknown>>,
): UpdatableChartOptions {
	const result: Record<string, unknown> = { ...initialRootPropsState }
	for (const key of rootPropKeys) {
		/* eslint-disable-next-line solid/reactivity -- seed snapshot, called untracked at store creation */
		const value = chartProps[key]
		if (value !== undefined) {
			result[key] = value
		}
	}
	return result as UpdatableChartOptions
}
