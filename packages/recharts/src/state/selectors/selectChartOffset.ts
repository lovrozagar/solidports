/* eslint-disable import/no-cycle */
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import type { ChartOffsetInternal } from "../../util/types"
import type { ChartOffset } from "../../types"
import type { ChartState } from "../store"

export function selectChartOffset(state: ChartState): ChartOffset {
	const offsetInternal: ChartOffsetInternal = selectChartOffsetInternal(state)
	return {
		bottom: offsetInternal.bottom,
		left: offsetInternal.left,
		right: offsetInternal.right,
		top: offsetInternal.top,
	}
}
