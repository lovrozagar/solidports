import type { JSX } from '@solidjs/web';
import { untrack } from "solid-js"
import { clsx } from "clsx"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { CartesianViewBox } from "../util/types"

import { bindRef, splitProps } from '../util/solid-1-compat';
interface SurfaceProps {
	width: number | string
	height: number | string
	viewBox?: CartesianViewBox
	class?: string
	style?: JSX.CSSProperties
	children?: JSX.Element
	title?: string
	desc?: string
	ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
}

export type Props = Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "viewBox"> & SurfaceProps

/**
 * Renders an SVG element.
 *
 * All charts already include a Surface component, so you would not normally use this directly.
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
 */
export function Surface(props: Props) {
	const [local, others] = splitProps(props, [
		"children",
		"class",
		"desc",
		"height",
		"ref",
		"style",
		"title",
		"viewBox",
		"width",
	])

	const svgView = () => local.viewBox || { height: local.height, width: local.width, x: 0, y: 0 }
	const layerClass = () => clsx("recharts-surface", local.class)
	const svgRest = () => svgPropertiesAndEvents(others)

	return (
		<svg
			{...svgRest()}
			class={layerClass()}
			width={local.width}
			height={local.height}
			style={local.style}
			viewBox={`${svgView().x} ${svgView().y} ${svgView().width} ${svgView().height}`}
			ref={(el) => untrack(() => bindRef(props.ref, el))}
		>
			<title>{local.title}</title>
			<desc>{local.desc}</desc>
			{local.children}
		</svg>
	)
}
