/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { Props as FunnelProps, FunnelTrapezoidItem } from "../cartesian/Funnel"
import { Shape } from "./ActiveShapeUtils"

export type FunnelTrapezoidProps = {
	option: FunnelProps["activeShape"]
	isActive: boolean
} & FunnelTrapezoidItem

export function FunnelTrapezoid(props: FunnelTrapezoidProps): JSX.Element {
	return <Shape shapeType="trapezoid" {...props} />
}
