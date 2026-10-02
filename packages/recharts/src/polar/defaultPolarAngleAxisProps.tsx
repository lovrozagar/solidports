/* eslint-disable import/no-cycle */
import { Props } from "./PolarAngleAxis"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"

export const defaultPolarAngleAxisProps = {
	allowDataOverflow: false,
	allowDecimals: false,
	allowDuplicatedCategory: true,
	angle: 0,
	angleAxisId: 0,
	axisLine: true,
	axisLineType: "polygon",
	cx: 0,
	cy: 0,
	hide: false,
	includeHidden: false,
	label: false,
	orientation: "outer",
	reversed: false,
	scale: "auto",
	niceTicks: "auto",
	tick: true,
	tickLine: true,
	tickSize: 8,
	type: "auto",
	zIndex: DefaultZIndexes.axis,
} as const satisfies Props
