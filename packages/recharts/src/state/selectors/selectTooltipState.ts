/* eslint-disable import/no-cycle */
import { untrack } from "solid-js"
import type { RechartsRootState } from "../store"
import type { TooltipState } from "../tooltipSlice"

function isInteractionActive(t: TooltipState): boolean {
	return (
		t.axisInteraction.click.active ||
		t.axisInteraction.hover.active ||
		t.itemInteraction.click.active ||
		t.itemInteraction.hover.active ||
		t.keyboardInteraction.active ||
		t.syncInteraction.active
	)
}

export const selectTooltipState = (state: RechartsRootState): TooltipState => {
	const newTooltip = (state._solid as Partial<typeof state._solid>).tooltip
	/* _solid is always initialized — only absent on legacy-only mounts with no ChartState.
	   When both are present, use _solid as authoritative (receives mouseLeave clears).
	   Exception: unit tests dispatch directly to state.tooltip without a provider;
	   detect this by checking legacy-active-but-_solid-idle via untrack (no reactive deps). */
	if (newTooltip != null) {
		const legacyActive = untrack(() => isInteractionActive(state.tooltip))
		const newActive = untrack(() => isInteractionActive(newTooltip))
		if (legacyActive && !newActive) {
			return state.tooltip
		}
		return newTooltip
	}
	return state.tooltip
}
