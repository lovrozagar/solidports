/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { TooltipSettingsState } from "../tooltipSlice"

export const selectTooltipSettings = (state: RechartsRootState): TooltipSettingsState => {
	const solidTooltip = (state._solid as Partial<typeof state._solid>).tooltip
	/* Legacy compat shim — _solid.tooltip absent when tests partially override _solid */
	const settings = solidTooltip?.settings ?? state.tooltip.settings
	const rawDefaultIndex = settings.defaultIndex
	return {
		...settings,
		defaultIndex:
			typeof rawDefaultIndex === "number" ? String(rawDefaultIndex) : rawDefaultIndex,
	}
}
