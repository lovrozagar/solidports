import type { LayoutType, Size } from "../util/types"
import type {
	HorizontalAlignmentType,
	LegendPayload,
	VerticalAlignmentType,
} from "../component/DefaultLegendContent"
import type { LegendItemSorter } from "../component/Legend"

export type LegendSettings = {
	align: HorizontalAlignmentType
	itemSorter: LegendItemSorter | null
	layout: LayoutType
	verticalAlign: VerticalAlignmentType
}

/**
 * The properties inside this state update independently of each other and quite often.
 * When selecting, never select the whole state because you are going to get
 * unnecessary re-renders. Select only the properties you need.
 *
 * This is why this state type is not exported - don't use it directly.
 */
export type LegendState = {
	payload: ReadonlyArray<ReadonlyArray<LegendPayload>>
	settings: LegendSettings
	size: Size
}
