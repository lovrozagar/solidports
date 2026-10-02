import type { JSX } from '@solidjs/web';
import type { WithoutRemoveFalse } from "../util/types"
import { untrack } from "solid-js"
import { clsx } from "clsx"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"

import { bindRef, splitProps } from '../util/solid-1-compat';
interface LayerProps {
	class?: string
	children?: JSX.Element
	ref?: SVGGElement | ((el: SVGGElement) => void)
}

export type Props = WithoutRemoveFalse<JSX.SvgSVGAttributes<SVGGElement>> & LayerProps

/**
 * Creates an SVG group element to group other SVG elements.
 *
 * Useful if you want to apply transformations or styles to a set of elements
 * without affecting other elements in the SVG.
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/g
 */
export function Layer(props: Props) {
	const [local, others] = splitProps(props, ["children", "class", "ref"])
	const layerClass = () => clsx("recharts-layer", local.class)
	const svgRest = () => svgPropertiesAndEvents(others)

	return (
		<g
			class={layerClass()}
			{...svgRest()}
			ref={(el) => untrack(() => bindRef(local.ref, el))}
		>
			{local.children}
		</g>
	)
}
