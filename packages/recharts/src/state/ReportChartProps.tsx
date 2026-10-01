/* eslint-disable import/no-cycle */
import { createEffect, onCleanup } from "solid-js"
import type { UpdatableChartOptions } from "./rootPropsSlice"
import { initialRootPropsState } from "./rootPropsSlice"
import { useOptionalChartState } from "./useChartState"

export function ReportChartProps(props: UpdatableChartOptions): null {
	const ctx = useOptionalChartState()
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setState("rootProps", {
			accessibilityLayer: props.accessibilityLayer,
			barCategoryGap: props.barCategoryGap,
			barGap: props.barGap,
			barSize: props.barSize,
			baseValue: props.baseValue,
			className: props.className,
			maxBarSize: props.maxBarSize,
			reverseStackOrder: props.reverseStackOrder,
			stackOffset: props.stackOffset,
			syncId: props.syncId,
			syncMethod: props.syncMethod,
		})
	})

	onCleanup(() => {
		ctx.setState("rootProps", { ...initialRootPropsState })
	})

	return null
}
