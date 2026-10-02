/* eslint-disable import/no-cycle */
import { RootSurface } from "../container/RootSurface"
import { RechartsWrapper } from "./RechartsWrapper"
import { ClipPathProvider } from "../container/ClipPathProvider"
import { useIsPanorama } from "../context/PanoramaContext"
import type { CartesianChartProps } from "../util/types"
import { svgPropertiesNoEvents } from "../util/svgPropertiesNoEvents"
import { ReportChartSize } from "../context/chartLayoutContext"

import { untrack } from "solid-js"
import { bindRef, splitProps } from '../util/solid-1-compat';
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
	/* Upstream Brush clones its child chart with `compact: true`; Solid cannot clone
	   JSX, so a chart rendered inside the Brush panorama is compact by context.
	   `compact` is set once at creation and never changes at runtime. */
	const isPanorama = useIsPanorama()
	if (isPanorama || untrack(() => local.compact)) {
		return (
			<>
				<ReportChartSize width={local.width} height={local.height} />
				<RootSurface
					otherAttributes={attrs()}
					title={local.title}
					desc={local.desc}
				>
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
			<RootSurface
				otherAttributes={attrs()}
				title={local.title}
				desc={local.desc}
				ref={(el) => bindRef(local.ref, el)}
			>
				<ClipPathProvider>{local.children}</ClipPathProvider>
			</RootSurface>
		</RechartsWrapper>
	)
}
