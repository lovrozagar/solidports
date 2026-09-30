import { ChartOffsetInternal } from "../../src/util/types"

export const emptyOffset: ChartOffsetInternal = {
	bottom: 0,
	brushBottom: 0,
	height: 0,
	left: 0,
	right: 0,
	top: 0,
	width: 0,
}

export function makeChartOffset(partialOffset: Partial<ChartOffsetInternal>): ChartOffsetInternal {
	return {
		...emptyOffset,
		...partialOffset,
	}
}
