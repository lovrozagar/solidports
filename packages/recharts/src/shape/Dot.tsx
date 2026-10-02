/* eslint-disable import/no-cycle */
import { Show } from 'solid-js';
import { useShapeElementProps } from "../util/ShapeElementProps"
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
export function Dot(ownProps: Props) {
	/* Props injected for a shape passed as an element (see ShapeElementProps). */
	const props = useShapeElementProps(ownProps)
	/* React-style `className` (e.g. from an activeDot object) merges into `class`. */
	const layerClass = () =>
		clsx("recharts-dot", props.class, (props as { className?: string }).className)
	const svgProps = () => {
		const { className: _className, ...rest } = svgPropertiesNoEvents(props) as Record<string, unknown>
		return rest
	}

	return (
		<Show when={isNumber(props.cx) && isNumber(props.cy) && isNumber(props.r)}>
			<circle
				{...svgProps()}
				{...adaptEventHandlers(props)}
				/* cx/cy/r come from the spread in prop order, matching upstream's attribute order */
				class={layerClass()}
			/>
		</Show>
	)
}
