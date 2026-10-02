import { createEffect, onCleanup } from "solid-js"
import { useOptionalChartState } from "./useChartState"
import type { PolarChartOptions } from "./polarOptionsSlice"
import { teardownWrite } from "./teardownWrite"

export function ReportPolarOptions(props: PolarChartOptions): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(
		() => ({
			cx: props.cx,
			cy: props.cy,
			endAngle: props.endAngle,
			innerRadius: props.innerRadius,
			outerRadius: props.outerRadius,
			startAngle: props.startAngle,
		}),
		(polarOptions) => {
			ctx.setState("polarOptions", polarOptions)
		},
	)

	onCleanup(() => {
		teardownWrite(() => {
			/* polarOptions is `PolarChartOptions | null`. reconcile(null) tries to
			   adopt a null store target and throws STORE_TARGET. */
			ctx.setState("polarOptions", null)
		})
	})

	return null
}
