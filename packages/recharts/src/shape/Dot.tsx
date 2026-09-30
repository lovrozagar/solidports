/* eslint-disable import/no-cycle */
import { Show } from "solid-js"
import { clsx } from "clsx"
import type { PresentationAttributesWithProps } from "../util/types"
import { adaptEventHandlers } from "../util/types"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { isNumber } from "../util/DataUtils"

interface DotProps {
	class?: string
	/**
	 * The x-coordinate of center in pixels.
	 */
	cx?: number
	/**
	 * The y-coordinate of center in pixels.
	 */
	cy?: number
	/**
	 * The radius of dot.
	 */
	r?: number | string
	clipDot?: boolean
}

export type Props = PresentationAttributesWithProps<DotProps, SVGCircleElement> & DotProps

/**
 * Renders a dot in the chart.
 *
 * This component accepts X and Y coordinates in pixels.
 * If you need to position the rectangle based on your chart's data,
 * consider using the {@link ReferenceDot} component instead.
 */
export function Dot(props: Props) {
	const layerClass = () => clsx("recharts-dot", props.class)

	return (
		<Show when={isNumber(props.cx) && isNumber(props.cy) && isNumber(props.r)}>
			<circle
				{...svgPropertiesNoEvents(props)}
				{...adaptEventHandlers(props)}
				class={layerClass()}
				cx={props.cx}
				cy={props.cy}
				r={props.r}
			/>
		</Show>
	)
}
