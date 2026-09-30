/* eslint-disable import/no-cycle */
import { splitProps } from "solid-js"
import { RootSurface } from "../container/RootSurface"
import { RechartsWrapper } from "./RechartsWrapper"
import { ClipPathProvider } from "../container/ClipPathProvider"
import type { CartesianChartProps } from "../util/types"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { ReportChartSize } from "../context/chartLayoutContext"

export function CategoricalChart(
	props: CartesianChartProps & {
		ref?: SVGSVGElement | ((el: SVGSVGElement) => void)
	},
) {
	const [local, others] = splitProps(props, [
		"width",
		"height",
		"responsive",
		"children",
		"className",
		"style",
		"compact",
		"title",
		"desc",
		"ref",
		"onClick",
		"onMouseLeave",
		"onMouseEnter",
		"onMouseMove",
		"onMouseDown",
		"onMouseUp",
		"onContextMenu",
		"onDoubleClick",
		"onTouchStart",
		"onTouchMove",
		"onTouchEnd",
	])
	const attrs = () => svgPropertiesNoEvents(others)

	/*
	 * The "compact" mode is used as the panorama within Brush.
	 * However because `compact` is a public prop, let's assume that it can render outside of Brush too.
	 */
	/* eslint-disable-next-line solid/reactivity -- `compact` is set once at creation (Brush panorama); never changes at runtime */
	if (local.compact) {
		return (
			<>
				<ReportChartSize width={local.width} height={local.height} />
				<RootSurface otherAttributes={attrs()} title={local.title} desc={local.desc}>
					{local.children}
				</RootSurface>
			</>
		)
	}

	return (
		<RechartsWrapper
			class={local.className}
			style={local.style}
			width={local.width}
			height={local.height}
			responsive={local.responsive ?? false}
			onClick={local.onClick}
			onMouseLeave={local.onMouseLeave}
			onMouseEnter={local.onMouseEnter}
			onMouseMove={local.onMouseMove}
			onMouseDown={local.onMouseDown}
			onMouseUp={local.onMouseUp}
			onContextMenu={local.onContextMenu}
			onDoubleClick={local.onDoubleClick}
			onTouchStart={local.onTouchStart}
			onTouchMove={local.onTouchMove}
			onTouchEnd={local.onTouchEnd}
		>
			<RootSurface otherAttributes={attrs()} title={local.title} desc={local.desc} ref={local.ref}>
				<ClipPathProvider>{local.children}</ClipPathProvider>
			</RootSurface>
		</RechartsWrapper>
	)
}
