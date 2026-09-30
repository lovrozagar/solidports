import type { JSX } from "solid-js"
import { splitProps } from "solid-js"
import { clsx } from "clsx"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"

interface LayerProps {
	class?: string
	children?: JSX.Element
	ref?: SVGGElement | ((el: SVGGElement) => void)
}

export type Props = JSX.SvgSVGAttributes<SVGGElement> & LayerProps

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

	return (
		<g class={layerClass()} {...svgPropertiesAndEvents(others)} ref={local.ref}>
			{local.children}
		</g>
	)
}
