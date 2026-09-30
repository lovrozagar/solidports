/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { RadialBarDataItem, RadialBarProps } from "../polar/RadialBar"
import { Shape } from "./ActiveShapeUtils"

export function parseCornerRadius(cornerRadius: string | number | undefined): number | undefined {
	if (typeof cornerRadius === "string") {
		return parseInt(cornerRadius, 10)
	}

	return cornerRadius
}

export interface RadialBarSectorProps extends RadialBarDataItem {
	index: number
	option: RadialBarProps["activeShape"]
	isActive: boolean
	className?: string
}

export function RadialBarSector(props: RadialBarSectorProps): JSX.Element {
	return <Shape shapeType="sector" {...props} />
}
