import type { ChartState } from "../state/store"
import type { TooltipSyncState } from "../state/tooltipSlice"
import { readChartState } from "../state/chartState"

export function selectSynchronisedTooltipState(state: ChartState): TooltipSyncState {
	return readChartState(state).tooltip.syncInteraction
}
