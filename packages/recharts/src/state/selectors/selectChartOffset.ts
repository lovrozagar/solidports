/* eslint-disable import/no-cycle */
import { selectChartOffsetInternal } from "./selectChartOffsetInternal"
import type { ChartOffsetInternal } from "../../util/types"
import type { ChartOffset } from "../../types"
import type { RechartsRootState } from "../store"

export function selectChartOffset(state: RechartsRootState): ChartOffset {
	const offsetInternal: ChartOffsetInternal = selectChartOffsetInternal(state)
	return {
		bottom: offsetInternal.bottom,
		left: offsetInternal.left,
		right: offsetInternal.right,
		top: offsetInternal.top,
	}
}
