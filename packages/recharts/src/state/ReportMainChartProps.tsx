import { createEffect, onCleanup } from 'solid-js';
import type { LayoutType, Margin } from "../util/types"
import { useIsPanorama } from "../context/PanoramaContext"
import { initialLayoutState } from "./layoutSlice"
import { useOptionalChartState } from "./useChartState"
import { teardownWrite } from "./teardownWrite"

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

	/* The chart root seeds layout at store creation; this keeps it in sync after mount. */
	createEffect(
		() => ({
			layoutType: props.layout,
			/* upstream setMargin: missing sides become 0 */
			margin: {
				bottom: props.margin.bottom ?? 0,
				left: props.margin.left ?? 0,
				right: props.margin.right ?? 0,
				top: props.margin.top ?? 0,
			},
		}),
		(next) => {
			if (!isPanorama) {
				ctx.setState("layout", "layoutType", next.layoutType)
				ctx.setState("layout", "margin", next.margin)
			}
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			if (!isPanorama) {
				ctx.setState("layout", "layoutType", initialLayoutState.layoutType)
				ctx.setState("layout", "margin", { ...initialLayoutState.margin })
			}
		})
	})

	return null
}
