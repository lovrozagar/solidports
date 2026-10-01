/* eslint-disable import/no-cycle */
import type { ChartState } from "../store"
import type { TooltipSettingsState } from "../tooltipSlice"
import { readChartState } from "../chartState"

export const selectTooltipSettings = (state: ChartState): TooltipSettingsState => {
	const settings = readChartState(state).tooltip.settings
	const rawDefaultIndex = settings.defaultIndex
	return {
		...settings,
		defaultIndex:
			typeof rawDefaultIndex === "number" ? String(rawDefaultIndex) : rawDefaultIndex,
	}
}
