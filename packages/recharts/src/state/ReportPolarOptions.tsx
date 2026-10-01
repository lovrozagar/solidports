import { createEffect, onCleanup } from "solid-js"
import { reconcile } from "solid-js/store"
import { useOptionalChartState } from "./useChartState"
import type { PolarChartOptions } from "./polarOptionsSlice"
import { initialPolarOptionsState } from "./polarOptionsSlice"

export function ReportPolarOptions(props: PolarChartOptions): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setState("polarOptions", {
			cx: props.cx,
			cy: props.cy,
			endAngle: props.endAngle,
			innerRadius: props.innerRadius,
			outerRadius: props.outerRadius,
			startAngle: props.startAngle,
		})
	})

	onCleanup(() => {
		ctx.setState("polarOptions", reconcile(initialPolarOptionsState))
	})

	return null
}
