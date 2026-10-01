import { createRenderEffect, onCleanup } from "solid-js"
import type { LayoutType, Margin } from "../util/types"
import { useIsPanorama } from "../context/PanoramaContext"
import { initialLayoutState } from "./layoutSlice"
import { useOptionalChartState } from "./useChartState"

/**
 * "Main" props are props that are only accepted on the main chart,
 * as opposed to the small panorama chart inside a Brush.
 */
type MainChartProps = {
	layout: LayoutType
	margin: Partial<Margin>
}

export function ReportMainChartProps(props: MainChartProps): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	/*
	 * Skip dispatching properties in panorama chart for two reasons:
	 * 1. The root chart should be deciding on these properties, and
	 * 2. Brush reads these properties from the store, and so they must remain stable
	 *      to avoid circular dependency and infinite re-rendering.
	 */
	const isPanorama = useIsPanorama()

	/* createRenderEffect runs synchronously during setup so layout state
	   populates BEFORE downstream sibling components (Customized, user JSX)
	   begin their setup. Mirrors React's render-then-layout-effect timing
	   for the test contract `useOffsetInternal()` returning populated value
	   on first read. */
	createRenderEffect(() => {
		if (!isPanorama) {
			ctx.setState("layout", "layoutType", props.layout)
			ctx.setState("layout", "margin", {
				bottom: props.margin.bottom ?? initialLayoutState.margin.bottom,
				left: props.margin.left ?? initialLayoutState.margin.left,
				right: props.margin.right ?? initialLayoutState.margin.right,
				top: props.margin.top ?? initialLayoutState.margin.top,
			})
		}
	})

	onCleanup(() => {
		if (!isPanorama) {
			ctx.setState("layout", "layoutType", initialLayoutState.layoutType)
			ctx.setState("layout", "margin", { ...initialLayoutState.margin })
		}
	})

	return null
}
