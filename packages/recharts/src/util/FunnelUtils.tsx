/* eslint-disable import/no-cycle */
import type { JSX } from '@solidjs/web';
import { Props as FunnelProps, FunnelTrapezoidItem } from "../cartesian/Funnel"
import { Shape } from "./ActiveShapeUtils"
import type { ShapeAnimationProps } from "./types"

export type FunnelTrapezoidProps = {
	option: FunnelProps["activeShape"]
	isActive: boolean
} & ShapeAnimationProps &
	FunnelTrapezoidItem

export function FunnelTrapezoid(props: FunnelTrapezoidProps): JSX.Element {
	return <Shape shapeType="trapezoid" {...props} />
}
