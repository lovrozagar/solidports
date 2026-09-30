/* eslint-disable import/no-cycle */
import { useChartStore } from "../state/RechartsStoreContext"
import { getBandSizeOfAxis } from "../util/ChartUtils"
import type { RenderableAxisSettings } from "../state/selectors/axisSelectors"
import { selectTooltipAxis } from "../state/selectors/axisSelectors"
import { selectTooltipAxisScale, selectTooltipAxisTicks } from "../state/selectors/tooltipSelectors"

export const useTooltipAxis = (): RenderableAxisSettings | undefined => {
	const ctx = useChartStore()
	return ctx ? selectTooltipAxis(ctx.store) : undefined
}

export const useTooltipAxisBandSize = (): number | undefined => {
	const ctx = useChartStore()
	const axis = useTooltipAxis()
	const tooltipTicks = ctx ? selectTooltipAxisTicks(ctx.store) : undefined
	const tooltipAxisScale = ctx ? selectTooltipAxisScale(ctx.store) : undefined
	if (axis == null || tooltipAxisScale == null) {
		return getBandSizeOfAxis(undefined, tooltipTicks)
	}
	return getBandSizeOfAxis({ ...axis, scale: tooltipAxisScale }, tooltipTicks)
}
