import type { LayoutType, Size } from "../util/types"
import type {
	HorizontalAlignmentType,
	LegendPayload,
	VerticalAlignmentType,
} from "../component/DefaultLegendContent"
import type { LegendItemSorter } from "../component/Legend"

/** Keyword or coordinate position; same vocabulary as Label. Avoids importing CartesianLabelPosition (cycle). */
export type LegendPosition =
	| "top"
	| "left"
	| "right"
	| "bottom"
	| "inside"
	| "outside"
	| "insideLeft"
	| "insideRight"
	| "insideTop"
	| "insideBottom"
	| "insideTopLeft"
	| "insideBottomLeft"
	| "insideTopRight"
	| "insideBottomRight"
	| "insideStart"
	| "insideEnd"
	| "end"
	| "center"
	| "centerTop"
	| "centerBottom"
	| "middle"
	| {
			x?: number | string
			y?: number | string
	  }

export type LegendSettings = {
	align: HorizontalAlignmentType
	itemSorter: LegendItemSorter | null
	layout: LayoutType
	verticalAlign: VerticalAlignmentType
	position?: LegendPosition
	offset?: number
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
