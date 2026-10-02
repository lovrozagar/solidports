import type { ChartState } from "./chartState"
import type { TooltipInteractionState } from "./tooltipSlice"

type DraftSetter = (write: (draft: ChartState) => void) => void

/**
 * A chart's own pointer interaction, mirroring upstream's setMouseOverAxisIndex /
 * setMouseClickAxisIndex / setActiveMouseOverItemIndex / setActiveClickItemIndex reducers:
 * it ends any incoming synchronisation and keyboard interaction before recording itself.
 */
export function setTooltipInteraction(
	setState: DraftSetter,
	interaction: "axisInteraction" | "itemInteraction",
	trigger: "hover" | "click",
	payload: TooltipInteractionState,
): void {
	setState((draft) => {
		draft.tooltip.syncInteraction.active = false
		draft.tooltip.syncInteraction.sourceViewBox = undefined
		draft.tooltip.keyboardInteraction.active = false
		draft.tooltip[interaction][trigger] = payload
	})
}
