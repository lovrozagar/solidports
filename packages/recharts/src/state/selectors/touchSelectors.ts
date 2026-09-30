/* eslint-disable import/no-cycle */
import type { RechartsRootState } from "../store"
import type { TooltipIndex, TooltipPayloadConfiguration } from "../tooltipSlice"
import type { Coordinate } from "../../util/types"
import { selectTooltipState } from "./selectTooltipState"
import type { GraphicalItemId } from "../graphicalItemsSlice"

function selectAllTooltipPayloadConfiguration(
	state: RechartsRootState,
): ReadonlyArray<TooltipPayloadConfiguration> {
	const tooltipState = selectTooltipState(state)
	return tooltipState.tooltipItemPayloads
}

export function selectTooltipCoordinate(
	state: RechartsRootState,
	tooltipIndex: TooltipIndex,
	graphicalItemId: GraphicalItemId,
): Coordinate | undefined {
	const allTooltipConfigurations = selectAllTooltipPayloadConfiguration(state)

	if (tooltipIndex == null) {
		return undefined
	}
	const mostRelevantTooltipConfiguration = allTooltipConfigurations.find((tooltipConfiguration) => {
		return tooltipConfiguration.settings.graphicalItemId === graphicalItemId
	})
	if (mostRelevantTooltipConfiguration == null) {
		return undefined
	}
	const { getPosition } = mostRelevantTooltipConfiguration
	if (getPosition == null) {
		return undefined
	}
	return getPosition(tooltipIndex)
}
