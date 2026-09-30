/* eslint-disable import/no-cycle */
import { createEffect, onCleanup, useContext } from "solid-js"
import type { UpdatableChartOptions } from "./rootPropsSlice"
import { initialRootPropsState } from "./rootPropsSlice"
import { RechartsStoreContext } from "./RechartsStoreContext"

export function ReportChartProps(props: UpdatableChartOptions): null {
	const ctx = useContext(RechartsStoreContext)
	if (ctx == null) {
		return null
	}

	createEffect(() => {
		ctx.setStore("rootProps", {
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
		ctx.setStore("rootProps", { ...initialRootPropsState })
	})

	return null
}
