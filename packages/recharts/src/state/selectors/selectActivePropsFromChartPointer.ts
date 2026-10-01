/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { ActiveTooltipProps } from "../tooltipSlice"
import { selectChartLayout } from "../../context/chartLayoutContext"
import { selectTooltipAxisRangeWithReverse, selectTooltipAxisTicks } from "./tooltipSelectors"
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import { combineActiveProps, selectOrderedTooltipTicks } from "./selectors"
import { selectPolarViewBox } from "./polarAxisSelectors"
import type { RelativePointer } from "../../util/types"
import { selectTooltipAxisType } from "./selectTooltipAxisType"

export function selectActivePropsFromChartPointer(
	state: ChartState,
	chartPointer: RelativePointer,
): ActiveTooltipProps | undefined {
	return combineActiveProps(
		chartPointer,
		selectChartLayout(state),
		selectPolarViewBox(state),
		selectTooltipAxisType(state),
		selectTooltipAxisRangeWithReverse(state),
		selectTooltipAxisTicks(state),
		selectOrderedTooltipTicks(state),
		selectChartOffsetInternal(state),
	)
}
