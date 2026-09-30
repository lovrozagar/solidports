/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { BasePolarGraphicalItemSettings } from "../graphicalItemsSlice"
import { DataKey, LegendType } from "../../util/types"
import { TooltipType } from "../../component/DefaultTooltipContent"
import { SVGPropsNoEvents } from "../../util/svgPropertiesNoEvents"
import { WithoutId } from "../../util/useUniqueId"

export type PiePresentationProps = SVGPropsNoEvents<
	WithoutId<JSX.PathSVGAttributes<SVGPathElement>>
>

export interface PieSettings extends BasePolarGraphicalItemSettings {
	type: "pie"
	name: string | number | undefined
	nameKey: DataKey<unknown>
	tooltipType: TooltipType | undefined

	legendType: LegendType
	fill: string

	cx: number | string
	cy: number | string
	startAngle: number
	endAngle: number
	paddingAngle: number
	minAngle: number
	innerRadius: number | string
	outerRadius: number | string | ((element: unknown) => number | string)
	maxRadius: number | undefined
	cornerRadius: number | string | undefined
	presentationProps: PiePresentationProps | null
}
