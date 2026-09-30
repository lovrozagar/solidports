import { createEffect, onCleanup, useContext } from "solid-js"
import { reconcile } from "solid-js/store"
import { RechartsStoreContext } from "./RechartsStoreContext"
import type { PolarChartOptions } from "./polarOptionsSlice"
import { initialPolarOptionsState } from "./polarOptionsSlice"

export function ReportPolarOptions(props: PolarChartOptions): null {
	const ctx = useContext(RechartsStoreContext)
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setStore("polarOptions", {
			cx: props.cx,
			cy: props.cy,
			endAngle: props.endAngle,
			innerRadius: props.innerRadius,
			outerRadius: props.outerRadius,
			startAngle: props.startAngle,
		})
	})

	onCleanup(() => {
		ctx.setStore("polarOptions", reconcile(initialPolarOptionsState))
	})

	return null
}
