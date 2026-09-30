/* eslint-disable import/no-cycle */
import { StackOffsetType } from "../util/types"
import { SyncMethod } from "../synchronisation/types"
import { BaseValue } from "../cartesian/Area"

/**
 * These are chart options that users can choose - which means they can also
 * choose to change them which should trigger a re-render.
 */
export type UpdatableChartOptions = {
	accessibilityLayer: boolean
	barCategoryGap: number | string
	barGap: number | string
	barSize: string | number | undefined
	baseValue: BaseValue | undefined
	/**
	 * Useful for debugging which chart is which when synchronising.
	 * The className is also passed to the root element of the chart but that's done in the JSX, not through Redux.
	 */
	className: string | undefined
	maxBarSize: number | undefined
	/**
	 * If false, stacked items will be rendered left to right. If true, stacked items will be rendered right to left.
	 * (Render direction affects SVG layering, not x position.)
	 */
	reverseStackOrder: boolean
	stackOffset: StackOffsetType
	/**
	 * Charts that share the same syncId will have their Tooltip and Brush synchronised.
	 */
	syncId: number | string | undefined
	syncMethod: SyncMethod
}

export const initialRootPropsState: UpdatableChartOptions = {
	accessibilityLayer: true,
	barCategoryGap: "10%",
	barGap: 4,
	barSize: undefined,
	baseValue: undefined,
	className: undefined,
	maxBarSize: undefined,
	reverseStackOrder: false,
	stackOffset: "none",
	syncId: undefined,
	syncMethod: "index",
}
